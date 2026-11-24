// Test support: fakes of the ports publishing reaches, the repository on GitHub and the branch Pages serves.

import type { PagesSettings } from "../../src/policies/pages_source.ts";
import type { ChangedFile } from "../../src/policies/changed_files.ts";
import type { GitHubRepository, PullRequestComment } from "../../src/ports/github_repository.ts";
import type { PushOutcome, SiteBranch } from "../../src/ports/site_branch.ts";
import { readSiteRequest, type SiteRequest } from "../../src/services/reading_site_inputs.ts";
import { FakeFiles, FakeGhgProcess, FakeRunner } from "./fakes.ts";

/** A repository whose Pages and comments are held in memory. */
export class FakeRepository implements GitHubRepository {
  pages: PagesSettings | "off" | undefined;
  comments: PullRequestComment[] | undefined = [];
  changedFiles: ChangedFile[] | undefined = [];
  /** What compareCommits gives, whatever the commits. */
  comparedFiles: ChangedFile[] | undefined = [];
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
  async compareCommits(): Promise<readonly ChangedFile[] | undefined> {
    return this.comparedFiles;
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
  /** Whether make's push is accepted. */
  makeAccepted = true;
  async make(): Promise<boolean> {
    this.steps.push("make");
    return this.makeAccepted;
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

/** The ports publishing reaches, whose branch's checkouts each hold the files given, .nojekyll at the root by default, and whose ghg builds as process says. */
export function publishingPorts(
  outcomes: PushOutcome[] = ["pushed"],
  repository = new FakeRepository(),
  onBranch = [".nojekyll"],
  process = new FakeGhgProcess(),
) {
  const checkouts = ["checkout-1", "checkout-2", "checkout-3"];
  return {
    runner: new FakeRunner(),
    repository,
    siteBranch: new FakeSiteBranch(outcomes),
    process,
    files: new FakeFiles(Object.fromEntries(checkouts.flatMap((checkout) => onBranch.map((file) => [`${checkout}/${file}`, ""])))),
  };
}

/** The request of the shared inputs, publishing on gh-pages with the title T, and the inputs given. */
export function siteRequest(inputs: Record<string, string> = {}): SiteRequest {
  return readSiteRequest(new FakeRunner({ to: "github-pages", branch: "gh-pages", token: "a-token", title: "T", ...inputs }));
}
