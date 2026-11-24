// Adapter: the repository the workflow runs in, through GitHub's REST API on the workflow's own server, with @actions/github.

import { GitHub, getUserAgentWithOrchestrationId } from "@actions/github/lib/utils";
import type { ChangedFile } from "../policies/changed_files.ts";
import { fieldOf } from "../policies/json_field.ts";
import type { PagesSettings } from "../policies/pages_source.ts";
import type { GitHubRepository, PullRequestComment } from "../ports/github_repository.ts";

/** The client of GitHub's REST API that @actions/github makes, with its typed methods and paginate. */
export type GitHubClient = InstanceType<typeof GitHub>;

// GitHub's API lists at most 100 comments, or files of a pull request, a page, and gives at most
// 300 files of a comparison (github/rest-api-description, api.github.com.json, the parameter
// per-page and the operation "Compare two commits").
const PAGE_SIZE = 100;
const COMPARED_FILES = 300;
const USER_AGENT = "gherkin-glass-action";

/**
 * The client for GITHUB_API_URL, such as https://api.github.com, through the runner's proxy, as
 * @actions/github sets it for that address (@actions/github 9.1.1, lib/utils.js, defaults), with
 * the user agent getOctokit would give. It is made from the class itself, since getOctokit throws
 * for an empty token (lib/internal/utils.js, getAuthString); an empty token then makes anonymous
 * requests, which GitHub refuses wherever the token is needed.
 */
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

  // GET /repos/{owner}/{repo}/pages answers 404 when Pages is off (github/rest-api-description,
  // api.github.com.json, the operation "Get a GitHub Pages site").
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
      // Octokit's RequestError holds the answer's status.
      return fieldOf(error, "status") === 404 ? "off" : undefined;
    }
  }

  // Octokit's paginate follows the link header to every page, up to the 3000 files GitHub lists.
  async listChangedFiles(pullRequest: number): Promise<readonly ChangedFile[] | undefined> {
    const request = { owner: this.owner, repo: this.repo, pull_number: pullRequest, per_page: PAGE_SIZE };
    return orUndefined(async () => changedFilesOf(await this.client.paginate(this.client.rest.pulls.listFiles, request)));
  }

  // The comparison gives its status, ahead when head follows base, and at most 300 files, so a
  // list that may be cut short cannot tell that no file matters.
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

// The files of a pull request or of a comparison: each one's path, removed for a removed file,
// and a renamed file's previous path, which it removes.
function changedFilesOf(files: readonly { filename: string; status: string; previous_filename?: string }[]): ChangedFile[] {
  return files.flatMap((file) => [
    { path: file.filename, removed: file.status === "removed" },
    ...(file.previous_filename === undefined ? [] : [{ path: file.previous_filename, removed: true }]),
  ]);
}

// Octokit throws for an answer that is not a success, and for a request that cannot be made
// (@octokit/request 10, RequestError); each is a request the action cannot use.
async function orUndefined<T>(request: () => Promise<T>): Promise<T | undefined> {
  try {
    return await request();
  } catch {
    return undefined;
  }
}
