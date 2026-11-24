// Policy: the inputs the publish and preview actions share, as docs/BEHAVIOUR.md, rules 19 and 28, say.

import { posix } from "node:path";

/** Where the site is published. */
export interface SiteInputs {
  /** The branch Pages serves. */
  readonly branch: string;
  /** The folder of the branch the site goes into, relative to its root and written with /, empty for the root itself. */
  readonly folder: string;
}

/**
 * The options of ghg build that the publish and preview actions pass from their inputs as they are;
 * they choose the rest themselves, and pass title themselves, since preview adds to it (rule 30).
 */
export const SITE_BUILD_INPUTS: readonly string[] = ["config", "input", "front-page"];

/** Where the inputs ask the site to be published, or the sentence the action stops with. */
export function siteInputsOf(inputOf: (name: string) => string): SiteInputs | { readonly problem: string } {
  // Rule 19: Pages is the only place a site is published today; to leaves room for others.
  if (inputOf("to") !== "github-pages") return { problem: "to must be github-pages." };
  const branch = inputOf("branch");
  if (branch === "") return { problem: "branch must name a branch." };
  const folder = folderOf(inputOf("folder"));
  if (folder === undefined) return { problem: "folder must be a folder of branch, such as features." };
  return { branch, folder };
}

/** Whether changed-only asks a preview to show only the files the pull request changes, or the sentence the action stops with. */
export function changedOnlyOf(input: string): boolean | { readonly problem: string } {
  if (input === "true") return true;
  if (input === "false" || input === "") return false;
  return { problem: "changed-only must be true or false." };
}

/** The folder of the branch a pull request's preview goes into, beside the versions in folder. */
export function previewFolderOf(folder: string, pullRequest: number): string {
  return posix.join(folder === "" ? "." : folder, "previews", `pr-${pullRequest}`);
}

// The folder without the / that may end it, or undefined when it is a whole path, or has an
// empty, . or .. folder in it, which would lead elsewhere than into the branch.
function folderOf(input: string): string | undefined {
  if (input.startsWith("/") || input.includes("\\") || /^[A-Za-z]:/.test(input)) return undefined;
  const folder = input.replace(/\/+$/, "");
  if (folder === "") return "";
  return folder.split("/").every((name) => name !== "" && name !== "." && name !== "..") ? folder : undefined;
}
