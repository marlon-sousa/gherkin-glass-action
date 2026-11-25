// Service: the root action from its inputs to its end.

import path from "node:path";
import { stopSentencesOf } from "../action_stop.ts";
import { ACTION_OPTIONS } from "../policies/build_arguments.ts";
import { optionsOf, type GhgOptions } from "../policies/ghg_options.ts";
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
export async function runAction(options: GhgOptions, ports: ActionPorts): Promise<void> {
  try {
    const { install, build } = readRequest(ports.runner);
    const passed = build === undefined ? undefined : { byInputs: optionsOf(build.buildArguments), byAction: ACTION_OPTIONS };
    const ghg = await installGhg(install.version, install.platform, passed, options, {
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
    for (const sentence of stopSentencesOf(error)) ports.runner.fail(sentence);
  }
}
