// Test support: fakes of the ports publishing reaches, the repository on GitHub and the branch Pages serves.

import type { PagesSettings } from "../../src/policies/pages_source.ts";
import type { ChangedFile } from "../../src/policies/changed_files.ts";
import type { GitHubRepository, PullRequestComment } from "../../src/ports/github_repository.ts";
import type { PushOutcome, SiteBranch } from "../../src/ports/site_branch.ts";

/** A repository whose Pages and comments are held in memory. */
export class FakeRepository implements GitHubRepository {
  pages: PagesSettings | "off" | undefined;
  comments: PullRequestComment[] | undefined = [];
  changedFiles: ChangedFile[] | undefined = [];
  writable = true;
  /** What was written: "add <pull request>: <body>" or "edit <id>: <body>". */
  readonly written: string[] = [];

  constructor(pages: PagesSettings | "off" | undefined = PAGES) {
    this.pages = pages;
  }

  async pagesSettings(): Promise<PagesSettings | "off" | undefined> {
    return this.pages;
  }
  async listChangedFiles(): Promise<readonly ChangedFile[] | undefined> {
    return this.changedFiles;
  }
  async listComments(): Promise<readonly PullRequestComment[] | undefined> {
    return this.comments;
  }
  async addComment(pullRequest: number, body: string): Promise<boolean> {
    this.written.push(`add ${pullRequest}: ${body}`);
    return this.writable;
  }
  async editComment(id: number, body: string): Promise<boolean> {
    this.written.push(`edit ${id}: ${body}`);
    return this.writable;
  }
}

/** Pages deploying the root of gh-pages, at https://owner.github.io/repo/. */
export const PAGES: PagesSettings = {
  buildType: "legacy",
  branch: "gh-pages",
  path: "/",
  address: "https://owner.github.io/repo/",
};

/** A branch that is checked out into checkout-<n>, and whose pushes come to the outcomes given, in turn. */
export class FakeSiteBranch implements SiteBranch {
  branchExists: boolean;
  readonly outcomes: PushOutcome[];
  /** What was done, in order: "make", "check out", "remove <folder>" and "push <message>". */
  readonly steps: string[] = [];
  private checkouts = 0;

  constructor(outcomes: PushOutcome[] = ["pushed"], branchExists = true) {
    this.outcomes = outcomes;
    this.branchExists = branchExists;
  }

  async exists(): Promise<boolean> {
    return this.branchExists;
  }
  async make(): Promise<void> {
    this.steps.push("make");
  }
  async checkOut(): Promise<string> {
    this.steps.push("check out");
    this.checkouts++;
    return `checkout-${this.checkouts}`;
  }
  async removeFolder(_checkout: string, folder: string): Promise<void> {
    this.steps.push(`remove ${folder}`);
  }
  async commitAndPush(_checkout: string, _branch: string, message: string): Promise<PushOutcome> {
    this.steps.push(`push ${message}`);
    return this.outcomes.shift() ?? "pushed";
  }
}
