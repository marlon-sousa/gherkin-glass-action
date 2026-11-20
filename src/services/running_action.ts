// Service: the root action from its inputs to its end, as docs/BEHAVIOUR.md, "The action" and "Outputs", say.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import { outputFolderOf } from "../policies/report_paths.ts";
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
  /** The releases of ghg, listed with the token the inputs give, if any. */
  readonly releasesWith: (token: string | undefined) => GhgReleases;
  readonly toolCache: GhgToolCache;
  readonly files: Files;
  readonly process: GhgProcess;
}

/** Reads the inputs, installs ghg, builds when asked, gives the outputs, then registers the problem matcher; fails the step when anything stops it. */
export async function runAction(pairedMajor: number, ports: ActionPorts): Promise<void> {
  try {
    const { install, build } = readRequest(ports.runner);
    const ghg = await installGhg(install.version, install.platform, pairedMajor, {
      ...ports,
      releases: ports.releasesWith(install.releasesToken),
    });
    ports.runner.setOutput("ghg-version", ghg.version);
    // Registered after the build, so that the action's own annotations are not made twice.
    try {
      if (build !== undefined) {
        await buildSite(ghg.program, build, ports);
        const outputFolder = outputFolderOf({ ...build, configText: await ports.files.readText(build.configFile) });
        // Rule 18: given as the build's report gives paths, from the workspace and with / on every
        // system, so that a later step's shell reads it alike everywhere.
        ports.runner.setOutput("site", path.normalize(outputFolder).split(path.sep).join("/"));
      } else {
        ports.runner.setOutput("site", "");
      }
    } finally {
      await ports.runner.addProblemMatcher();
    }
  } catch (error: unknown) {
    ports.runner.fail(error instanceof ActionStop ? error.message : `The action failed unexpectedly: ${String(error)}`);
  }
}
