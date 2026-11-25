// Service: the root action from its inputs to its end.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import type { Files } from "../ports/files.ts";
import type { GhgProcess } from "../ports/ghg_process.ts";
import type { GhgReleases } from "../ports/ghg_releases.ts";
import type { GhgToolCache } from "../ports/ghg_tool_cache.ts";
import type { Runner } from "../ports/runner.ts";
import { buildSite } from "./building.ts";
import { installGhg } from "./installing.ts";
import { readRequest } from "./reading_inputs.ts";

export interface ActionPorts {
  readonly runner: Runner;
  readonly releasesWith: (token: string | undefined) => GhgReleases;
  readonly toolCache: GhgToolCache;
  readonly files: Files;
  readonly process: GhgProcess;
}

/** Fails the step itself, so its promise never rejects. */
export async function runAction(pairedMajor: number, ports: ActionPorts): Promise<void> {
  try {
    const { install, build } = readRequest(ports.runner);
    const ghg = await installGhg(install.version, install.platform, build !== undefined, pairedMajor, {
      ...ports,
      releases: ports.releasesWith(install.releasesToken),
    });
    ports.runner.setOutput("ghg-version", ghg.version);
    // The problem matcher is registered after the build, or the action's own annotations would be made twice.
    try {
      const built = build === undefined ? undefined : await buildSite(ghg.program, build, ports);
      const site = built?.outcome === "built" ? path.normalize(built.output).split(path.sep).join("/") : "";
      ports.runner.setOutput("site", site);
    } finally {
      await ports.runner.addProblemMatcher();
    }
  } catch (error: unknown) {
    ports.runner.fail(error instanceof ActionStop ? error.message : `The action failed unexpectedly: ${String(error)}`);
  }
}
