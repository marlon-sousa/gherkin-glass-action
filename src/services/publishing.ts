// Service: changes the branch Pages serves once Pages is ready for it, as docs/BEHAVIOUR.md, rules 19 to 22, say.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import { keptInOutputArguments } from "../policies/kept_in_output.ts";
import {
  folderOutsideProblem,
  jekyllProblem,
  noJekyllFileOf,
  notFromBranchProblem,
  pagesReadinessOf,
} from "../policies/pages_source.ts";
import type { SiteInputs } from "../policies/site_inputs.ts";
import type { GitHubRepository } from "../ports/github_repository.ts";
import type { SiteBranch } from "../ports/site_branch.ts";
import { buildSite, type BuildingPorts } from "./building.ts";
import type { SiteRequest } from "./reading_site_inputs.ts";

export interface PublishingPorts extends BuildingPorts {
  readonly repository: GitHubRepository;
  readonly siteBranch: SiteBranch;
}

/** Where Pages serves the branch: the folder it serves, relative to the branch's root, and that folder's address. */
export interface ServedSite {
  readonly servedFolder: string;
  readonly address: string;
}

/** A change to the branch: the message of its commit, and what it does to a checkout, false to leave the branch as it is. */
export interface BranchChange {
  readonly message: string;
  apply(checkout: string): Promise<boolean>;
}

// Rule 22: another push may reach the branch first; the action starts again, three times in all.
const ATTEMPTS = 3;

/**
 * Rule 20: where Pages serves the branch, or an ActionStop when it does not serve it with a
 * folder that holds folder. A branch that does not exist is made first, since Pages can be set
 * only to one that does.
 */
export async function servedSiteOf(site: SiteInputs, ports: PublishingPorts): Promise<ServedSite> {
  const settings = await ports.repository.pagesSettings();
  if (settings === undefined) {
    throw new ActionStop("The settings of Pages cannot be read: the workflow needs the permission pages: read.");
  }
  const readiness = pagesReadinessOf(settings === "off" ? undefined : settings, site.branch, site.folder);
  if (readiness.kind === "ready") return readiness;
  if (readiness.kind === "folder-outside") throw new ActionStop(folderOutsideProblem(readiness.servedFolder, site.branch));
  const exists = await ports.siteBranch.exists(site.branch);
  if (!exists && !(await ports.siteBranch.make(site.branch))) throw new ActionStop(pushRefusedProblem(site.branch));
  throw new ActionStop(notFromBranchProblem(site.branch, !exists));
}

/**
 * Checks out the branch's newest commit, applies the change, and commits and pushes what it
 * changed: left when the change left the branch as it is, unchanged when it changed nothing.
 * Stops before the change when Jekyll would leave pages out (rule 21).
 */
export async function changeBranch(
  branch: string,
  served: ServedSite,
  change: BranchChange,
  ports: PublishingPorts,
): Promise<"pushed" | "unchanged" | "left"> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const checkout = await ports.siteBranch.checkOut(branch);
    if (!(await ports.files.isFile(path.join(checkout, ...noJekyllFileOf(served.servedFolder).split("/"))))) {
      throw new ActionStop(jekyllProblem(served.servedFolder, branch));
    }
    if (!(await change.apply(checkout))) return "left";
    const outcome = await ports.siteBranch.commitAndPush(checkout, branch, change.message);
    if (outcome === "behind") continue;
    if (outcome === "refused") throw new ActionStop(pushRefusedProblem(branch));
    if (outcome === "unchanged") ports.runner.log(`The site on ${branch} is already up to date.`);
    return outcome;
  }
  throw new ActionStop(`The site cannot be pushed to ${branch}.`);
}

function pushRefusedProblem(branch: string): string {
  return `The site cannot be pushed to ${branch}: the workflow needs the permission contents: write.`;
}

/**
 * Builds the site into a folder of the checked-out branch, relative to its root, keeping what
 * rule 19 keeps, with the arguments the action adds; true when ghg wrote it, false when it had
 * nothing to build (rule 7).
 */
export async function buildIntoBranch(
  ghg: string,
  request: SiteRequest,
  output: { readonly checkout: string; readonly folder: string },
  added: readonly string[],
  ports: PublishingPorts,
): Promise<boolean> {
  const kept = keptInOutputArguments(request.keepInOutput, await ports.files.readText(request.build.configFile));
  const outputArgument = `--output=${path.join(output.checkout, ...output.folder.split("/"))}`;
  const buildArguments = [...request.build.buildArguments, ...kept, outputArgument, ...added];
  const built = await buildSite(ghg, { ...request.build, buildArguments }, ports);
  return built.outcome === "built";
}
