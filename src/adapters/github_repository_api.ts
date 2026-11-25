// Adapter: the repository the workflow runs in, through GitHub's REST API on the workflow's own server, with @actions/github.

import { GitHub, getUserAgentWithOrchestrationId } from "@actions/github/lib/utils";
import type { ChangedFile } from "../policies/changed_files.ts";
import { fieldOf } from "../policies/json_field.ts";
import type { PagesSettings } from "../policies/pages_source.ts";
import type { GitHubRepository, PullRequestComment } from "../ports/github_repository.ts";

export type GitHubClient = InstanceType<typeof GitHub>;

// GitHub's API lists at most 100 items a page, and 300 files of a comparison.
const PAGE_SIZE = 100;
const COMPARED_FILES = 300;
const USER_AGENT = "gherkin-glass-action";

/** Made as @actions/github 9.1.1's getOctokit makes it, which throws for an empty token; an empty token here makes anonymous requests. */
export function gitHubClientOf(apiAddress: string, token: string): GitHubClient {
  const userAgent = getUserAgentWithOrchestrationId(USER_AGENT) ?? USER_AGENT;
  return new GitHub({ baseUrl: apiAddress, userAgent, ...(token !== "" && { auth: token }) });
}

export class GitHubRepositoryApi implements GitHubRepository {
  private readonly client: GitHubClient;
  private readonly owner: string;
  private readonly repo: string;

  /** repository is GITHUB_REPOSITORY, such as owner/repo. */
  constructor(client: GitHubClient, repository: string) {
    this.client = client;
    const [owner = "", repo = ""] = repository.split("/");
    this.owner = owner;
    this.repo = repo;
  }

  // GitHub answers 404 when Pages is off.
  async pagesSettings(): Promise<PagesSettings | "off" | undefined> {
    try {
      const { data } = await this.client.rest.repos.getPages({ owner: this.owner, repo: this.repo });
      if (typeof data.html_url !== "string") return undefined;
      return {
        buildType: data.build_type ?? undefined,
        branch: data.source?.branch,
        path: data.source?.path,
        address: data.html_url,
      };
    } catch (error) {
      return fieldOf(error, "status") === 404 ? "off" : undefined;
    }
  }

  async listChangedFiles(pullRequest: number): Promise<readonly ChangedFile[] | undefined> {
    const request = { owner: this.owner, repo: this.repo, pull_number: pullRequest, per_page: PAGE_SIZE };
    return orUndefined(async () => changedFilesOf(await this.client.paginate(this.client.rest.pulls.listFiles, request)));
  }

  // Undefined when the list may be cut short.
  async compareCommits(before: string, after: string): Promise<readonly ChangedFile[] | undefined> {
    const basehead = `${before}...${after}`;
    return orUndefined(async () => {
      const { data } = await this.client.rest.repos.compareCommitsWithBasehead({ owner: this.owner, repo: this.repo, basehead });
      if (!["ahead", "identical"].includes(data.status) || data.files === undefined) return undefined;
      return data.files.length >= COMPARED_FILES ? undefined : changedFilesOf(data.files);
    });
  }

  async listComments(pullRequest: number): Promise<readonly PullRequestComment[] | undefined> {
    const request = { owner: this.owner, repo: this.repo, issue_number: pullRequest, per_page: PAGE_SIZE };
    return orUndefined(async () => {
      const comments = await this.client.paginate(this.client.rest.issues.listComments, request);
      const read = comments.flatMap(({ id, body }) => (typeof body === "string" ? [{ id, body }] : []));
      return read.length === comments.length ? read : undefined;
    });
  }

  async addComment(pullRequest: number, body: string): Promise<boolean> {
    const request = { owner: this.owner, repo: this.repo, issue_number: pullRequest, body };
    return (await orUndefined(() => this.client.rest.issues.createComment(request))) !== undefined;
  }

  async editComment(id: number, body: string): Promise<boolean> {
    const request = { owner: this.owner, repo: this.repo, comment_id: id, body };
    return (await orUndefined(() => this.client.rest.issues.updateComment(request))) !== undefined;
  }
}

// A renamed file's previous path is removed.
function changedFilesOf(files: readonly { filename: string; status: string; previous_filename?: string }[]): ChangedFile[] {
  return files.flatMap((file) => [
    { path: file.filename, removed: file.status === "removed" },
    ...(file.previous_filename === undefined ? [] : [{ path: file.previous_filename, removed: true }]),
  ]);
}

// @octokit/request 10 throws for an answer that is not a success and for a request that cannot be made.
async function orUndefined<T>(request: () => Promise<T>): Promise<T | undefined> {
  try {
    return await request();
  } catch {
    return undefined;
  }
}
