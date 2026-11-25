// Policy: the inputs the publish and preview actions share.

import { posix } from "node:path";
import { ACTION_OPTIONS } from "./build_arguments.ts";

export interface SiteInputs {
  readonly branch: string;
  /** Relative to the branch's root and written with /, empty for the root itself. */
  readonly folder: string;
}

/** The options of ghg build the publish and preview actions pass from their inputs unchanged. */
export const SITE_BUILD_INPUTS: readonly string[] = ["config", "input", "front-page"];

/** The options of ghg build the publish action gives itself. */
export const PUBLISH_OPTIONS: readonly string[] = [...ACTION_OPTIONS, "output", "keep-in-output", "version-name"];

/** The options of ghg build the preview action gives itself. */
export const PREVIEW_OPTIONS: readonly string[] = [...ACTION_OPTIONS, "output", "keep-in-output", "title", "preview", "only"];

/** Or the sentence the action stops with. */
export function siteInputsOf(inputOf: (name: string) => string): SiteInputs | { readonly problem: string } {
  if (inputOf("to") !== "github-pages") return { problem: "to must be github-pages." };
  const branch = inputOf("branch");
  if (branch === "") return { problem: "branch must name a branch." };
  const folder = folderOf(inputOf("folder"));
  if (folder === undefined) return { problem: "folder must be a folder of branch, such as features." };
  return { branch, folder };
}

/** Or the sentence the action stops with. */
export function changedOnlyOf(input: string): boolean | { readonly problem: string } {
  if (input === "true") return true;
  if (input === "false" || input === "") return false;
  return { problem: "changed-only must be true or false." };
}

export function previewFolderOf(folder: string, pullRequest: number): string {
  return posix.join(folder === "" ? "." : folder, "previews", `pr-${pullRequest}`);
}

// Undefined when it is a whole path, or has an empty, . or .. folder in it.
function folderOf(input: string): string | undefined {
  if (input.startsWith("/") || input.includes("\\") || /^[A-Za-z]:/.test(input)) return undefined;
  const folder = input.replace(/\/+$/, "");
  if (folder === "") return "";
  return folder.split("/").every((name) => name !== "" && name !== "." && name !== "..") ? folder : undefined;
}
