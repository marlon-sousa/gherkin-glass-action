// Service: the publish and preview actions from their inputs to their end.

import { ActionStop, orStop } from "../action_stop.ts";
import { changedOnlyOf } from "../policies/site_inputs.ts";
import { previewEventOf, versionNameOf } from "../policies/workflow_event.ts";
import type { GitHubRepository } from "../ports/github_repository.ts";
import type { Runner } from "../ports/runner.ts";
import type { SiteBranch } from "../ports/site_branch.ts";
import { installGhg } from "./installing.ts";
import type { PublishingPorts } from "./publishing.ts";
import { publishPreview, removePreview } from "./publishing_preview.ts";
import { publishVersion } from "./publishing_version.ts";
import { readSiteRequest, type SiteRequest } from "./reading_site_inputs.ts";
import type { ActionPorts } from "./running_action.ts";

export interface SiteActionPorts extends ActionPorts {
  readonly repositoryWith: (token: string) => GitHubRepository;
  readonly siteBranchWith: (token: string) => SiteBranch;
}

type Publishing = (installedGhg: () => Promise<string>, ports: PublishingPorts) => Promise<void>;

/** Fails the step itself, so its promise never rejects. */
export async function runPublish(pairedMajor: number, ports: SiteActionPorts): Promise<void> {
  await runSiteAction(pairedMajor, ports, (request, runner) => {
    const versionName = versionNameOf(runner.input("version-name"), runner.workflowEvent().refName);
    return async (installedGhg, publishingPorts) =>
      publishVersion(await installedGhg(), { ...request, versionName }, publishingPorts);
  });
}

/** Fails the step itself, so its promise never rejects. */
export async function runPreview(pairedMajor: number, ports: SiteActionPorts): Promise<void> {
  await runSiteAction(pairedMajor, ports, (request, runner) => {
    const changedOnly = orStop(changedOnlyOf(runner.input("changed-only")));
    const event = orStop(previewEventOf(runner.workflowEvent()));
    if (event.kind === "fork") {
      runner.notice("This pull request comes from a fork, whose token cannot push, so its preview is not published.");
      return undefined;
    }
    if (event.kind === "closed") return (_installedGhg, publishingPorts) => removePreview(event.pullRequest, request, publishingPorts);
    return async (installedGhg, publishingPorts) =>
      publishPreview(await installedGhg(), { ...request, changedOnly }, event, publishingPorts);
  });
}

// publishingOf gives undefined when there is nothing to do.
async function runSiteAction(
  pairedMajor: number,
  ports: SiteActionPorts,
  publishingOf: (request: SiteRequest, runner: Runner) => Publishing | undefined,
): Promise<void> {
  try {
    const request = readSiteRequest(ports.runner);
    const publishing = publishingOf(request, ports.runner);
    if (publishing === undefined) return;
    const installedGhg = async () => {
      const ghg = await installGhg(request.install.version, request.install.platform, true, pairedMajor, {
        ...ports,
        releases: ports.releasesWith(request.install.releasesToken),
      });
      return ghg.program;
    };
    await publishing(installedGhg, {
      ...ports,
      repository: ports.repositoryWith(request.token),
      siteBranch: ports.siteBranchWith(request.token),
    });
  } catch (error: unknown) {
    ports.runner.fail(error instanceof ActionStop ? error.message : `The action failed unexpectedly: ${String(error)}`);
  }
}
