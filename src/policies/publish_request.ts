// Policy: the inputs that ask for the site to be published, as docs/BEHAVIOUR.md, rules 18 and 26, say.

/** Where the action is asked to publish, when publish is true. */
export interface PublishInputs {
  /** The branch Pages serves. */
  readonly branch: string;
  /** The folder of the branch the site goes into, relative to its root and written with /, empty for the root itself. */
  readonly folder: string;
  /** Whether a pull request's preview shows only the files it changes. */
  readonly changedOnly: boolean;
}

/**
 * Where the inputs ask the site to be published, undefined when publish is not true, or the
 * sentence the action stops with.
 */
export function publishInputsOf(
  inputOf: (name: string) => string,
): PublishInputs | undefined | { readonly problem: string } {
  const publish = inputOf("publish");
  if (publish === "false" || publish === "") return undefined;
  if (publish !== "true") return { problem: "publish must be true or false." };
  const branch = inputOf("publish-branch");
  if (branch === "") return { problem: "publish-branch must name a branch." };
  const folder = folderOf(inputOf("publish-folder"));
  if (folder === undefined) return { problem: "publish-folder must be a folder of publish-branch, such as features." };
  if (inputOf("output") !== "") return { problem: "publish writes the site into publish-branch, so output must be empty." };
  if (inputOf("preview") === "true") return { problem: "publish chooses which sites are previews, so preview must be empty." };
  const changedOnly = inputOf("changed-only");
  if (!["true", "false", ""].includes(changedOnly)) return { problem: "changed-only must be true or false." };
  if (changedOnly === "true" && inputOf("only") !== "") {
    return { problem: "changed-only gives ghg the files the pull request changes, so only must be empty." };
  }
  return { branch, folder, changedOnly: changedOnly === "true" };
}

// The folder without the / that may end it, or undefined when it is a whole path, or has an
// empty, . or .. folder in it, which would lead elsewhere than into the branch.
function folderOf(input: string): string | undefined {
  const folder = input.replace(/\/+$/, "");
  if (folder === "") return "";
  if (folder.startsWith("/") || folder.includes("\\") || /^[A-Za-z]:/.test(folder)) return undefined;
  return folder.split("/").every((name) => name !== "" && name !== "." && name !== "..") ? folder : undefined;
}
