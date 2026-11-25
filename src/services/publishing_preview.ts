// Service: publishes a pull request's preview on the branch Pages serves, and removes it.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import { changesPreviewSources, filesToPreview } from "../policies/changed_files.ts";
import { addressOf } from "../policies/pages_source.ts";
import { previewTitleOf } from "../policies/preview_title.ts";
import { builtFromOf, previewCommentAmong, previewCommentOf, REMOVED_PREVIEW_COMMENT } from "../policies/preview_comment.ts";
import { reportPathsOf, type ReportPaths } from "../policies/report_paths.ts";
import { previewFolderOf } from "../policies/site_inputs.ts";
import type { PreviewEvent } from "../policies/workflow_event.ts";
import type { PullRequestComment } from "../ports/github_repository.ts";
import { buildIntoBranch, changeBranch, servedSiteOf, type PublishingPorts } from "./publishing.ts";
import type { SiteRequest } from "./reading_site_inputs.ts";

export interface PreviewRequest extends SiteRequest {
  readonly changedOnly: boolean;
}

export type OpenPullRequest = Extract<PreviewEvent, { readonly kind: "open" }>;

const COMMENT_PROBLEM = "The comment of the pull request's preview cannot be written.";

// The file ghg marks the folder of a site without versions with.
const SITE_MARKER = "ghg-site.json";

export async function publishPreview(
  ghg: string,
  request: PreviewRequest,
  event: OpenPullRequest,
  ports: PublishingPorts,
): Promise<void> {
  const configText = await ports.files.readText(request.build.configFile);
  const paths = reportPathsOf({ ...request.build, configText });
  const title = `--title=${previewTitleOf(request.title, configText, event.pullRequest)}`;
  const only = request.changedOnly ? await changedOnlyArguments(event.pullRequest, paths, ports) : [];
  if (only === undefined) {
    ports.runner.log("This pull request changes no file of the input folder, so no preview is published.");
    return;
  }
  const served = await servedSiteOf(request, ports);
  const folder = previewFolderOf(request.folder, event.pullRequest);
  const comment = await previewCommentOn(event.pullRequest, ports);
  const builtFrom = comment === undefined ? undefined : builtFromOf(comment.body);
  const sourcesKept = await keepsSources(builtFrom, event.headCommit, paths, ports);
  let nothingToBuild = false;
  const outcome = await changeBranch(
    request.branch,
    served,
    {
      message: `Publish the preview of pull request #${event.pullRequest}`,
      apply: async (checkout) => {
        const output = path.join(checkout, ...folder.split("/"));
        if (sourcesKept && (await ports.files.isFile(path.join(output, SITE_MARKER)))) return false;
        nothingToBuild = !(await buildIntoBranch(ghg, request, { checkout, folder }, [title, "--preview", ...only], ports));
        return !nothingToBuild;
      },
    },
    ports,
  );
  if (nothingToBuild) {
    ports.runner.log("ghg read no feature file, so no preview is published.");
    return;
  }
  const address = addressOf(served, folder);
  if (outcome === "left") {
    ports.runner.log("The commits since the preview was built change no file it is built from, so the preview is left as it is.");
  }
  if (outcome === "pushed") ports.runner.log(`The site is published on ${request.branch}, at ${address}.`);
  ports.runner.setOutput("address", address);
  await writeComment(event.pullRequest, comment, previewCommentOf(address, event.headCommit), ports);
}

export async function removePreview(pullRequest: number, request: SiteRequest, ports: PublishingPorts): Promise<void> {
  const served = await servedSiteOf(request, ports);
  const comment = await previewCommentOn(pullRequest, ports);
  const folder = previewFolderOf(request.folder, pullRequest);
  const outcome = await changeBranch(
    request.branch,
    served,
    {
      message: `Remove the preview of pull request #${pullRequest}`,
      apply: async (checkout) => {
        await ports.siteBranch.removeFolder(checkout, folder);
        return true;
      },
    },
    ports,
  );
  if (outcome === "pushed") ports.runner.log(`The preview of pull request #${pullRequest} is removed from ${request.branch}.`);
  if (comment !== undefined) await writeComment(pullRequest, comment, REMOVED_PREVIEW_COMMENT, ports);
}

// Undefined when the pull request changes no file of the input folder.
async function changedOnlyArguments(pullRequest: number, paths: ReportPaths, ports: PublishingPorts) {
  const changed = await ports.repository.listChangedFiles(pullRequest);
  if (changed === undefined) throw new ActionStop("The files the pull request changes cannot be listed.");
  const files = filesToPreview(changed, paths.inputFolder, ports.runner.workspace);
  if (files.length === 0) return undefined;
  return [`--only=${await ports.files.writeTemporary("changed-files.txt", files.map((file) => `${file}\n`).join(""))}`];
}

// False when either commit is not known or they cannot be compared.
async function keepsSources(
  builtFrom: string | undefined,
  headCommit: string | undefined,
  paths: ReportPaths,
  ports: PublishingPorts,
): Promise<boolean> {
  if (builtFrom === undefined || headCommit === undefined) return false;
  const changed = await ports.repository.compareCommits(builtFrom, headCommit);
  return changed !== undefined && !changesPreviewSources(changed, paths, ports.runner.workspace);
}

async function previewCommentOn(pullRequest: number, ports: PublishingPorts): Promise<PullRequestComment | undefined> {
  const comments = await ports.repository.listComments(pullRequest);
  if (comments === undefined) throw new ActionStop(COMMENT_PROBLEM);
  return previewCommentAmong(comments);
}

async function writeComment(
  pullRequest: number,
  comment: PullRequestComment | undefined,
  body: string,
  ports: PublishingPorts,
): Promise<void> {
  if (comment?.body === body) return;
  const written =
    comment === undefined
      ? await ports.repository.addComment(pullRequest, body)
      : await ports.repository.editComment(comment.id, body);
  if (!written) throw new ActionStop(COMMENT_PROBLEM);
}
