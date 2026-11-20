// Adapter: the repository the workflow runs in, through GitHub's REST API on the workflow's own server.

import { HttpClient } from "@actions/http-client";
import type { PagesSettings } from "../policies/pages_source.ts";
import type { ChangedFile } from "../policies/changed_files.ts";
import type { GitHubRepository, PullRequestComment } from "../ports/github_repository.ts";

// GitHub's API lists at most 100 comments, or files of a pull request, a page, and at most 3000
// files of a pull request in all (github/rest-api-description, api.github.com.json, the parameter
// per-page and the operation "List pull requests files").
const PAGE_SIZE = 100;
const COMPARED_FILES = 300;

export class GitHubRepositoryApi implements GitHubRepository {
  private readonly httpClient = new HttpClient("gherkin-glass-action");
  /** Such as https://api.github.com/repos/owner/repo. */
  private readonly repositoryAddress: string;
  private readonly token: string;

  /** apiAddress is GITHUB_API_URL, such as https://api.github.com, and repository GITHUB_REPOSITORY, such as owner/repo. */
  constructor(apiAddress: string, repository: string, token: string) {
    this.repositoryAddress = `${apiAddress}/repos/${repository}`;
    this.token = token;
  }

  // GET /repos/{owner}/{repo}/pages answers 404 when Pages is off (github/rest-api-description,
  // api.github.com.json, the operation "Get a GitHub Pages site").
  async pagesSettings(): Promise<PagesSettings | "off" | undefined> {
    const response = await this.request("GET", "/pages");
    if (response?.status === 404) return "off";
    if (response?.status !== 200) return undefined;
    return pagesSettingsOf(response.body);
  }

  async listChangedFiles(pullRequest: number): Promise<readonly ChangedFile[] | undefined> {
    return this.listAll(`/pulls/${pullRequest}/files`, changedFilesOf);
  }

  // GET /repos/{owner}/{repo}/compare/{basehead} gives at most 300 files, and its status, ahead
  // when head follows base (github/rest-api-description, api.github.com.json, the operation
  // "Compare two commits"). A list that may be cut short cannot tell that no file matters.
  async compareCommits(before: string, after: string): Promise<readonly ChangedFile[] | undefined> {
    const response = await this.request("GET", `/compare/${before}...${after}`);
    const files = field(response?.body, "files");
    const status = field(response?.body, "status");
    if (response?.status !== 200 || !Array.isArray(files) || !["ahead", "identical"].includes(String(status))) return undefined;
    if (files.length >= COMPARED_FILES) return undefined;
    return changedFilesOf(files);
  }

  async listComments(pullRequest: number): Promise<readonly PullRequestComment[] | undefined> {
    return this.listAll(`/issues/${pullRequest}/comments`, (page) => everyOrNone(page.map(commentOf)));
  }

  // Every item of a listing, page by page, or undefined when a page cannot be read or holds an
  // item that is not one.
  private async listAll<T>(listing: string, itemsOf: (page: unknown[]) => T[] | undefined): Promise<T[] | undefined> {
    const listed: T[] = [];
    for (let page = 1; ; page++) {
      const response = await this.request("GET", `${listing}?per_page=${PAGE_SIZE}&page=${page}`);
      if (response?.status !== 200 || !Array.isArray(response.body)) return undefined;
      const items = itemsOf(response.body);
      if (items === undefined) return undefined;
      listed.push(...items);
      if (response.body.length < PAGE_SIZE) return listed;
    }
  }

  async addComment(pullRequest: number, body: string): Promise<boolean> {
    return (await this.request("POST", `/issues/${pullRequest}/comments`, { body }))?.status === 201;
  }

  async editComment(id: number, body: string): Promise<boolean> {
    return (await this.request("PATCH", `/issues/comments/${id}`, { body }))?.status === 200;
  }

  // The status and the parsed body of a request, or undefined when it cannot be made.
  private async request(
    method: string,
    pathOfRepository: string,
    sent?: object,
  ): Promise<{ status: number | undefined; body: unknown } | undefined> {
    const headers = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${this.token}`,
      "content-type": "application/json",
    };
    try {
      const response = await this.httpClient.request(
        method,
        `${this.repositoryAddress}${pathOfRepository}`,
        sent === undefined ? null : JSON.stringify(sent),
        headers,
      );
      const text = await response.readBody();
      return { status: response.message.statusCode, body: text === "" ? undefined : JSON.parse(text) };
    } catch {
      return undefined;
    }
  }
}

// The settings GitHub's API gives: build_type, source.branch, source.path and html_url.
function pagesSettingsOf(body: unknown): PagesSettings | undefined {
  const address = field(body, "html_url");
  if (typeof address !== "string") return undefined;
  const buildType = field(body, "build_type");
  const branch = field(field(body, "source"), "branch");
  const path = field(field(body, "source"), "path");
  return {
    buildType: typeof buildType === "string" ? buildType : undefined,
    branch: typeof branch === "string" ? branch : undefined,
    path: typeof path === "string" ? path : undefined,
    address,
  };
}

// The files of a pull request or of a comparison: each one's filename, and its status, removed
// for a removed file; a renamed file's previous_filename is a file it removes.
function changedFilesOf(files: unknown[]): ChangedFile[] | undefined {
  return everyOrNone(
    files.map((file) => {
      const filename = field(file, "filename");
      const status = field(file, "status");
      if (typeof filename !== "string" || typeof status !== "string") return undefined;
      const previous = field(file, "previous_filename");
      const moved = typeof previous === "string" ? [{ path: previous, removed: true }] : [];
      return [{ path: filename, removed: status === "removed" }, ...moved];
    }),
  )?.flat();
}

function commentOf(comment: unknown): PullRequestComment | undefined {
  const id = field(comment, "id");
  const body = field(comment, "body");
  return typeof id === "number" && typeof body === "string" ? { id, body } : undefined;
}

// The items, or undefined when one of them is not one.
function everyOrNone<T>(items: (T | undefined)[]): T[] | undefined {
  const every = items.filter((item) => item !== undefined);
  return every.length === items.length ? every : undefined;
}

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && name in value ? Reflect.get(value, name) : undefined;
}
