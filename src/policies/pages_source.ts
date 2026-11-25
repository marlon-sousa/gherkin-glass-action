// Policy: whether Pages serves the branch the action publishes on, and the address of a folder of it.

import { posix } from "node:path";

export interface PagesSettings {
  /** "legacy" when Pages deploys from a branch, "workflow" when it deploys an Actions artifact. */
  readonly buildType: string | undefined;
  /** Undefined unless Pages deploys from a branch; path is the folder it serves, such as / or /docs. */
  readonly branch: string | undefined;
  readonly path: string | undefined;
  readonly address: string;
}

export type PagesReadiness =
  | { readonly kind: "ready"; readonly servedFolder: string; readonly address: string }
  | { readonly kind: "not-from-branch" }
  | { readonly kind: "folder-outside"; readonly servedFolder: string };

/** settings is undefined when Pages is off; servedFolder is relative to the branch's root, empty for the root. */
export function pagesReadinessOf(settings: PagesSettings | undefined, branch: string, folder: string): PagesReadiness {
  if (settings === undefined || settings.buildType !== "legacy" || settings.branch !== branch) {
    return { kind: "not-from-branch" };
  }
  const servedFolder = (settings.path ?? "/").replace(/^\/+|\/+$/g, "");
  const holds = servedFolder === "" || folder === servedFolder || folder.startsWith(`${servedFolder}/`);
  return holds
    ? { kind: "ready", servedFolder, address: settings.address }
    : { kind: "folder-outside", servedFolder: `/${servedFolder}` };
}

/** made says the action has just made the branch. */
export function notFromBranchProblem(branch: string, made: boolean): string {
  const setting = `in the repository's Settings, under Pages, set the source to "Deploy from a branch" and choose ${branch}`;
  return made
    ? `The branch ${branch} is made: ${setting}, and add an empty .nojekyll file at its root.`
    : `Pages does not deploy from the branch ${branch}: ${setting}.`;
}

export function folderOutsideProblem(servedFolder: string, branch: string): string {
  return `Pages serves the folder ${servedFolder} of ${branch}, so folder must be in it.`;
}

export function noJekyllFileOf(servedFolder: string): string {
  return posix.join(servedFolder === "" ? "." : servedFolder, ".nojekyll");
}

export function jekyllProblem(servedFolder: string, branch: string): string {
  return `Pages runs Jekyll on ${branch}, which leaves out pages whose names start with _: add an empty .nojekyll file to the folder /${servedFolder} of ${branch}.`;
}

/** folder is relative to the branch's root. */
export function addressOf(readiness: { readonly servedFolder: string; readonly address: string }, folder: string): string {
  const below = posix.relative(readiness.servedFolder === "" ? "." : readiness.servedFolder, folder === "" ? "." : folder);
  const base = readiness.address.endsWith("/") ? readiness.address : `${readiness.address}/`;
  return below === "" ? base : `${base}${below}/`;
}
