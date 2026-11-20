// Test support: fakes of the ports, which record what the services do with them.

import type { Annotation } from "../../src/policies/report_annotations.ts";
import type { ReleaseListing } from "../../src/policies/versions.ts";
import type { Files } from "../../src/ports/files.ts";
import type { GhgProcess } from "../../src/ports/ghg_process.ts";
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import type { GhgToolCache } from "../../src/ports/ghg_tool_cache.ts";
import type { Runner } from "../../src/ports/runner.ts";

export class FakeRunner implements Runner {
  readonly inputs: Map<string, string>;
  readonly system: string;
  readonly processor: string;
  readonly onGitHubCom: boolean;
  readonly path: string[] = [];
  readonly logged: string[] = [];
  readonly annotations: Annotation[] = [];
  readonly failures: string[] = [];
  /** What the runner was asked, in order: "matcher" for the problem matcher, "fail" for a failure. */
  readonly events: string[] = [];

  constructor(inputs: Record<string, string> = {}, system = "Linux", processor = "X64", onGitHubCom = true) {
    this.inputs = new Map(Object.entries(inputs));
    this.onGitHubCom = onGitHubCom;
    this.system = system;
    this.processor = processor;
  }

  input(name: string): string {
    return this.inputs.get(name) ?? "";
  }
  addToPath(folder: string): void {
    this.path.push(folder);
  }
  log(line: string): void {
    this.logged.push(line);
  }
  annotate(annotation: Annotation): void {
    this.annotations.push(annotation);
  }
  fail(message: string): void {
    this.failures.push(message);
    this.events.push("fail");
  }
  async addProblemMatcher(): Promise<void> {
    this.events.push("matcher");
  }
}

/** Releases held in memory: each file of a release by its name, and its text as its content. */
export class FakeReleases implements GhgReleases {
  readonly listings: readonly ReleaseListing[] | undefined;
  readonly files: Map<string, string>;
  readonly downloads: string[] = [];

  constructor(listings: readonly ReleaseListing[] | undefined, files: Record<string, string> = {}) {
    this.listings = listings;
    this.files = new Map(Object.entries(files));
  }

  async listReleases(): Promise<readonly ReleaseListing[] | undefined> {
    return this.listings;
  }
  async downloadFile(version: string, fileName: string): Promise<string | undefined> {
    const file = `v${version}/${fileName}`;
    this.downloads.push(file);
    return this.files.has(file) ? `downloads/${file}` : undefined;
  }
}

/** Files held in memory, whose SHA-256 is given rather than computed. */
export class FakeFiles implements Files {
  readonly texts: Map<string, string>;
  readonly checksums: Map<string, string>;

  constructor(texts: Record<string, string> = {}, checksums: Record<string, string> = {}) {
    this.texts = new Map(Object.entries(texts));
    this.checksums = new Map(Object.entries(checksums));
  }

  async readText(file: string): Promise<string | undefined> {
    return this.texts.get(file);
  }
  async sha256Of(file: string): Promise<string> {
    return this.checksums.get(file) ?? "";
  }
  async isFile(file: string): Promise<boolean> {
    return this.texts.has(file);
  }
}

/** A tool cache that unpacks an archive into the folder unpacked/<archive>, and keeps it under cache/<version>. */
export class FakeToolCache implements GhgToolCache {
  readonly kept = new Set<string>();
  readonly unpacked: string[] = [];

  find(version: string): string | undefined {
    return this.kept.has(version) ? `cache/${version}` : undefined;
  }
  async unpack(archive: string): Promise<string> {
    this.unpacked.push(archive);
    return `unpacked/${archive}`;
  }
  async keep(_folder: string, version: string): Promise<string> {
    this.kept.add(version);
    return `cache/${version}`;
  }
}

/** A ghg that writes the given lines to its standard error and exits with the given status. */
export class FakeGhgProcess implements GhgProcess {
  readonly runs: (readonly string[])[] = [];
  readonly errorLines: readonly string[];
  readonly status: number;

  constructor(errorLines: readonly string[] = [], status = 0) {
    this.errorLines = errorLines;
    this.status = status;
  }

  async run(program: string, commandArguments: readonly string[], onErrorLine: (line: string) => void): Promise<number> {
    this.runs.push([program, ...commandArguments]);
    this.errorLines.forEach(onErrorLine);
    return this.status;
  }
}
