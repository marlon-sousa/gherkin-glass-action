// Port: the branch Pages serves, checked out where the action can build into it, and pushed back.

/** What a commit and push of the checked-out branch came to: refused when the server refused it for another reason than being behind. */
export type PushOutcome = "pushed" | "unchanged" | "behind" | "refused";

export interface SiteBranch {
  exists(branch: string): Promise<boolean>;
  /** Makes the branch, with one empty commit, and pushes it; false when the push is refused. */
  make(branch: string): Promise<boolean>;
  /** Checks out the branch's newest commit into a new folder, with no .git in it, and returns the folder. */
  checkOut(branch: string): Promise<string>;
  /** Removes a folder of the checked-out branch, relative to its root. */
  removeFolder(checkout: string, folder: string): Promise<void>;
  /** Commits what changed in the checkout with that message, and pushes it; behind when another push reached the branch first. */
  commitAndPush(checkout: string, branch: string, message: string): Promise<PushOutcome>;
}
