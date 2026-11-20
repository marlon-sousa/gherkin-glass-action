// Policy: whether Pages serves the branch the action publishes on, and the address of a folder of it, as docs/BEHAVIOUR.md, rules 21 and 24, say.

import { posix } from "node:path";

/** How Pages is set, as GitHub's API gives it (GET /repos/{owner}/{repo}/pages). */
export interface PagesSettings {
  /** legacy when Pages deploys from a branch, workflow when it deploys an Actions artifact. */
  readonly buildType: string | undefined;
  /** The branch and the folder it serves, such as / or /docs, when it deploys from a branch. */
  readonly branch: string | undefined;
  readonly path: string | undefined;
  /** The site's address, such as https://owner.github.io/repo/. */
  readonly address: string;
}

/** Whether the action may publish: the folder of the branch Pages serves, or why it may not. */
export type PagesReadiness =
  | { readonly kind: "ready"; readonly servedFolder: string; readonly address: string }
  | { readonly kind: "not-from-branch" }
  | { readonly kind: "folder-outside"; readonly servedFolder: string };

/** Whether Pages, undefined when it is off, serves the branch and a folder that holds the folder the action publishes into. */
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

/** The sentence the action stops with when Pages does not deploy from the branch; made says the action has just made it. */
export function notFromBranchProblem(branch: string, made: boolean): string {
  const setting = `in the repository's Settings, under Pages, set the source to "Deploy from a branch" and choose ${branch}.`;
  return made ? `The branch ${branch} is made: ${setting}` : `Pages does not deploy from the branch ${branch}: ${setting}`;
}

/** The sentence the action stops with when Pages serves a folder that does not hold publish-folder. */
export function folderOutsideProblem(servedFolder: string, branch: string): string {
  return `Pages serves the folder ${servedFolder} of ${branch}, so publish-folder must be in it.`;
}

/** The address of a folder of the branch, relative to its root, on the site of a branch that is ready. */
export function addressOf(readiness: { readonly servedFolder: string; readonly address: string }, folder: string): string {
  const below = posix.relative(readiness.servedFolder === "" ? "." : readiness.servedFolder, folder === "" ? "." : folder);
  const base = readiness.address.endsWith("/") ? readiness.address : `${readiness.address}/`;
  return below === "" ? base : `${base}${below}/`;
}
