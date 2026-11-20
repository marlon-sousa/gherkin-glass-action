// Service: publishes the site on the branch Pages serves, as docs/BEHAVIOUR.md, "Publishing", says.

import path, { posix } from "node:path";
import { ActionStop } from "../action_stop.ts";
import {
  addressOf,
  folderOutsideProblem,
  notFromBranchProblem,
  pagesReadinessOf,
} from "../policies/pages_source.ts";
import { filesToPreview } from "../policies/changed_files.ts";
import { previewCommentAmong, previewCommentOf, REMOVED_PREVIEW_COMMENT } from "../policies/preview_comment.ts";
import { reportPathsOf } from "../policies/report_paths.ts";
import type { PublishTarget } from "../policies/workflow_event.ts";
import type { GitHubRepository } from "../ports/github_repository.ts";
import type { SiteBranch } from "../ports/site_branch.ts";
import { buildSite, type BuildingPorts } from "./building.ts";
import type { PublishRequest } from "./reading_inputs.ts";

export interface PublishingPorts extends BuildingPorts {
  readonly repository: GitHubRepository;
  readonly siteBranch: SiteBranch;
}

// Rule 24: another push may reach the branch first; the action starts again, three times in all.
const ATTEMPTS = 3;

type Published = Exclude<PublishTarget, { readonly kind: "fork" }>;

/** Checks that Pages serves the branch, builds into it or removes from it, pushes, and comments on a pull request. */
export async function publishSite(
  ghg: string,
  request: PublishRequest & { readonly target: Published },
  ports: PublishingPorts,
): Promise<void> {
  const { target, branch } = request;
  const only = target.kind === "preview" && request.changedOnly ? await changedOnlyList(target.pullRequest, request, ports) : [];
  if (only === undefined) {
    ports.runner.log("This pull request changes no file of the input folder, so no preview is published.");
    return;
  }
  const readiness = await readinessOf(request, ports);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const checkout = await ports.siteBranch.checkOut(branch);
    if (target.kind === "removal") await ports.siteBranch.removeFolder(checkout, target.folder);
    else await buildSite(ghg, { ...request.build, buildArguments: [...argumentsOf(request, target, checkout), ...only] }, ports);
    const outcome = await ports.siteBranch.commitAndPush(checkout, branch, messageOf(target));
    if (outcome === "behind") continue;
    if (outcome === "refused") {
      throw new ActionStop(`The site cannot be pushed to ${branch}: the workflow needs the permission contents: write.`);
    }
    const folder = target.kind === "version" ? posix.join(target.folder, target.versionName) : target.folder;
    const address = addressOf(readiness, folder);
    ports.runner.log(pushedLine(target, outcome, branch, address));
    if (target.kind !== "version") await comment(target, address, ports.repository);
    return;
  }
  throw new ActionStop(`The site cannot be pushed to ${branch}.`);
}

// Rule 26: the --only argument of the files the pull request changes inside the input folder,
// or undefined when there is none.
async function changedOnlyList(pullRequest: number, request: PublishRequest, ports: PublishingPorts) {
  const changed = await ports.repository.listChangedFiles(pullRequest);
  if (changed === undefined) throw new ActionStop("The files the pull request changes cannot be listed.");
  const { inputFolder } = reportPathsOf({
    input: request.build.input,
    frontPage: request.build.frontPage,
    configFile: request.build.configFile,
    configText: await ports.files.readText(request.build.configFile),
  });
  const files = filesToPreview(changed, inputFolder, ports.runner.workspace);
  if (files.length === 0) return undefined;
  return [`--only=${await ports.files.writeTemporary("changed-files.txt", files.map((file) => `${file}\n`).join(""))}`];
}

// Rule 21: Pages must deploy from the branch, and serve a folder that holds publish-folder. A
// branch that does not exist is made first, since Pages can be set only to one that does.
async function readinessOf(request: PublishRequest, ports: PublishingPorts) {
  const settings = await ports.repository.pagesSettings();
  if (settings === undefined) {
    throw new ActionStop("The settings of Pages cannot be read: the workflow needs the permission pages: read.");
  }
  const readiness = pagesReadinessOf(settings === "off" ? undefined : settings, request.branch, request.folder);
  if (readiness.kind === "ready") return readiness;
  if (readiness.kind === "folder-outside") throw new ActionStop(folderOutsideProblem(readiness.servedFolder, request.branch));
  const exists = await ports.siteBranch.exists(request.branch);
  if (!exists) await ports.siteBranch.make(request.branch);
  throw new ActionStop(notFromBranchProblem(request.branch, !exists));
}

// Rules 22 and 23: a push adds a version to the folder, which ghg treats as its output folder; a
// pull request writes a preview into its own folder.
function argumentsOf(request: PublishRequest, target: Published, checkout: string): readonly string[] {
  const output = `--output=${path.join(checkout, ...target.folder.split("/"))}`;
  const how = target.kind === "version" ? `--version-name=${target.versionName}` : "--preview";
  return [...request.build.buildArguments, output, how];
}

// Rule 24: what the log says once the branch holds what was asked.
function pushedLine(target: Published, outcome: "pushed" | "unchanged", branch: string, address: string): string {
  if (outcome === "unchanged") return `The site on ${branch} is already up to date.`;
  if (target.kind === "removal") return `The preview of pull request #${target.pullRequest} is removed from ${branch}.`;
  return `The site is published on ${branch}, at ${address}.`;
}

function messageOf(target: Published): string {
  if (target.kind === "version") return `Publish the site's version ${target.versionName}`;
  if (target.kind === "preview") return `Publish the preview of pull request #${target.pullRequest}`;
  return `Remove the preview of pull request #${target.pullRequest}`;
}

// Rule 25: one comment, edited on every later push, and edited again once the preview is removed.
async function comment(
  target: Extract<Published, { readonly pullRequest: number }>,
  address: string,
  repository: GitHubRepository,
): Promise<void> {
  const cannot = new ActionStop("The comment of the pull request's preview cannot be written.");
  const comments = await repository.listComments(target.pullRequest);
  if (comments === undefined) throw cannot;
  const existing = previewCommentAmong(comments);
  const body = target.kind === "preview" ? previewCommentOf(address) : REMOVED_PREVIEW_COMMENT;
  if (existing?.body === body) return;
  let written: boolean;
  if (existing !== undefined) written = await repository.editComment(existing.id, body);
  else if (target.kind === "preview") written = await repository.addComment(target.pullRequest, body);
  else return;
  if (!written) throw cannot;
}
