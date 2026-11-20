// Service: the action from its inputs to its end, as docs/BEHAVIOUR.md, "The action", says.

import { ActionStop } from "../action_stop.ts";
import type { Files } from "../ports/files.ts";
import type { GhgProcess } from "../ports/ghg_process.ts";
import type { GhgReleases } from "../ports/ghg_releases.ts";
import type { GhgToolCache } from "../ports/ghg_tool_cache.ts";
import type { GitHubRepository } from "../ports/github_repository.ts";
import type { Runner } from "../ports/runner.ts";
import type { SiteBranch } from "../ports/site_branch.ts";
import { buildSite } from "./building.ts";
import { installGhg } from "./installing.ts";
import { publishSite } from "./publishing.ts";
import { readRequest } from "./reading_inputs.ts";

export interface ActionPorts {
  readonly runner: Runner;
  /** The releases of ghg, listed with the token the inputs give, if any. */
  readonly releasesWith: (token: string | undefined) => GhgReleases;
  readonly toolCache: GhgToolCache;
  readonly files: Files;
  readonly process: GhgProcess;
  /** The repository the workflow runs in, and the branch Pages serves, reached with the token the inputs give. */
  readonly repositoryWith: (token: string) => GitHubRepository;
  readonly siteBranchWith: (token: string) => SiteBranch;
}

/** Reads the inputs, installs ghg, builds and publishes when asked, then registers the problem matcher; fails the step when anything stops it. */
export async function runAction(pairedMajor: number, ports: ActionPorts): Promise<void> {
  try {
    const request = readRequest(ports.runner);
    const ghg = await installGhg(request.version, request.platform, pairedMajor, {
      ...ports,
      releases: ports.releasesWith(request.token),
    });
    // Registered after the build, so that the action's own annotations are not made twice.
    try {
      const publish = request.publish;
      if (publish?.target.kind === "fork") {
        ports.runner.notice("This pull request comes from a fork, whose token cannot push, so its preview is not published.");
      }
      // Rule 18: the build of what is published is the only one; a removal leaves build to decide alone.
      const publishesBuild = publish?.target.kind === "version" || publish?.target.kind === "preview";
      if (request.build !== undefined && !publishesBuild) await buildSite(ghg, request.build, ports);
      if (publish !== undefined && publish.target.kind !== "fork") {
        await publishSite(ghg, { ...publish, target: publish.target }, {
          ...ports,
          repository: ports.repositoryWith(publish.token),
          siteBranch: ports.siteBranchWith(publish.token),
        });
      }
    } finally {
      await ports.runner.addProblemMatcher();
    }
  } catch (error: unknown) {
    ports.runner.fail(error instanceof ActionStop ? error.message : `The action failed unexpectedly: ${String(error)}`);
  }
}
