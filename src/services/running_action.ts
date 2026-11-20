// Service: the action from its inputs to its end, as docs/BEHAVIOUR.md, "The action", says.

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
  /** The releases of ghg, listed with the token the inputs give, if any. */
  readonly releasesWith: (token: string | undefined) => GhgReleases;
  readonly toolCache: GhgToolCache;
  readonly files: Files;
  readonly process: GhgProcess;
}

/** Reads the inputs, installs ghg, builds when asked, then registers the problem matcher; fails the step when anything stops it. */
export async function runAction(pairedMajor: number, ports: ActionPorts): Promise<void> {
  try {
    const request = readRequest(ports.runner);
    const ghg = await installGhg(request.version, request.platform, pairedMajor, {
      ...ports,
      releases: ports.releasesWith(request.token),
    });
    // Registered after the build, so that the action's own annotations are not made twice.
    try {
      if (request.build !== undefined) await buildSite(ghg, request.build, ports);
    } finally {
      await ports.runner.addProblemMatcher();
    }
  } catch (error: unknown) {
    ports.runner.fail(error instanceof ActionStop ? error.message : `The action failed unexpectedly: ${String(error)}`);
  }
}
