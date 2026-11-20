// Port: the repository the workflow runs in, through GitHub's API: its Pages and its pull requests' comments.

import type { ChangedFile } from "../policies/changed_files.ts";
import type { PagesSettings } from "../policies/pages_source.ts";

/** A comment of a pull request. */
export interface PullRequestComment {
  readonly id: number;
  readonly body: string;
}

export interface GitHubRepository {
  /** How Pages is set; "off" when Pages is not on; undefined when it cannot be read. */
  pagesSettings(): Promise<PagesSettings | "off" | undefined>;
  /** Every file the pull request changes, undefined when they cannot be listed. */
  listChangedFiles(pullRequest: number): Promise<readonly ChangedFile[] | undefined>;
  /** Every comment of the pull request, undefined when they cannot be listed. */
  listComments(pullRequest: number): Promise<readonly PullRequestComment[] | undefined>;
  /** Adds a comment to the pull request; false when it cannot. */
  addComment(pullRequest: number, body: string): Promise<boolean>;
  /** Replaces the text of a comment; false when it cannot. */
  editComment(id: number, body: string): Promise<boolean>;
}
