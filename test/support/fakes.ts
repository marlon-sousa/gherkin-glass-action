// Test support: fakes of the ports, which record what the services do with them.

import type { Annotation } from "../../src/policies/report_annotations.ts";
import type { ReleaseListing } from "../../src/policies/versions.ts";
import type { Files } from "../../src/ports/files.ts";
import type { GhgProcess, GhgRun } from "../../src/ports/ghg_process.ts";
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import type { GhgToolCache } from "../../src/ports/ghg_tool_cache.ts";
import type { WorkflowEvent } from "../../src/policies/workflow_event.ts";
import type { Runner } from "../../src/ports/runner.ts";

export class FakeRunner implements Runner {
  readonly inputs: Map<string, string>;
  readonly system: string;
  readonly processor: string;
  readonly workspace = "/work";
  readonly onGitHubCom: boolean;
  readonly path: string[] = [];
  readonly logged: string[] = [];
  readonly annotations: Annotation[] = [];
  readonly failures: string[] = [];
  /** What the runner was asked, in order: "matcher" for the problem matcher, "fail" for a failure. */
  readonly events: string[] = [];
  readonly notices: string[] = [];
  readonly outputs = new Map<string, string>();
  /** The event that runs the workflow, a push of main unless a test sets another. */
  event: WorkflowEvent = { name: "push", refName: "main", payload: {} };

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
  setOutput(name: string, value: string): void {
    this.outputs.set(name, value);
  }
  log(line: string): void {
    this.logged.push(line);
  }
  notice(line: string): void {
    this.notices.push(line);
  }
  workflowEvent(): WorkflowEvent {
    return this.event;
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
  async writeTemporary(name: string, text: string): Promise<string> {
    const file = `temporary/${name}`;
    this.texts.set(file, text);
    return file;
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

/** The JSON object ghg build prints with --message-format=json, with those keys changed. */
export function ghgReport(given: Record<string, unknown> = {}): string {
  const report = { outcome: "built", output: "site", version: null, features: 1, scenarios: 1, notes: [], errors: [], ...given };
  return `${JSON.stringify(report)}\n`;
}

/** A ghg that prints the given standard output, a built site's report by default, and exits with the given status. */
export class FakeGhgProcess implements GhgProcess {
  readonly runs: (readonly string[])[] = [];
  readonly standardOutput: string;
  readonly status: number;

  constructor(standardOutput = ghgReport(), status = 0) {
    this.standardOutput = standardOutput;
    this.status = status;
  }

  async run(program: string, commandArguments: readonly string[]): Promise<GhgRun> {
    this.runs.push([program, ...commandArguments]);
    return { status: this.status, standardOutput: this.standardOutput };
  }
}
