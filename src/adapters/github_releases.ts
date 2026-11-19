// Adapter: the releases of ghg on GitHub, listed through its API and downloaded with @actions/tool-cache.

import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpClient } from "@actions/http-client";
import { downloadTool } from "@actions/tool-cache";
import type { ReleaseListing } from "../policies/versions.ts";
import type { GhgReleases } from "../ports/ghg_releases.ts";

/** Where gherkin-glass's releases are: GitHub's API and its downloads, which tests serve locally. */
export interface ReleaseAddresses {
  /** Such as https://api.github.com/repos/marlon-sousa/gherkin-glass. */
  readonly api: string;
  /** Such as https://github.com/marlon-sousa/gherkin-glass/releases/download. */
  readonly downloads: string;
}

export const GITHUB_RELEASES: ReleaseAddresses = {
  api: "https://api.github.com/repos/marlon-sousa/gherkin-glass",
  downloads: "https://github.com/marlon-sousa/gherkin-glass/releases/download",
};

// GitHub's API lists at most 100 releases a page.
const PAGE_SIZE = 100;

export class GitHubGhgReleases implements GhgReleases {
  private readonly httpClient = new HttpClient("gherkin-glass-action");
  private readonly addresses: ReleaseAddresses;
  /** Sent to GitHub's API, undefined when there is none to send. */
  private readonly token: string | undefined;

  constructor(addresses: ReleaseAddresses, token: string | undefined) {
    this.addresses = addresses;
    this.token = token;
  }

  async listReleases(): Promise<readonly ReleaseListing[] | undefined> {
    const listed: ReleaseListing[] = [];
    for (let page = 1; ; page++) {
      const releasesPage = await this.releasesPage(page);
      if (releasesPage === undefined) return undefined;
      listed.push(...releasesPage);
      if (releasesPage.length < PAGE_SIZE) return listed;
    }
  }

  async downloadFile(version: string, fileName: string): Promise<string | undefined> {
    // The file keeps its name, since extracting a zip on Windows needs its .zip.
    const folder = await mkdtemp(path.join(process.env["RUNNER_TEMP"] ?? os.tmpdir(), "ghg-"));
    try {
      return await downloadTool(`${this.addresses.downloads}/v${version}/${fileName}`, path.join(folder, fileName));
    } catch {
      return undefined;
    }
  }

  private async releasesPage(page: number): Promise<readonly ReleaseListing[] | undefined> {
    const headers: Record<string, string> = { accept: "application/vnd.github+json" };
    if (this.token !== undefined) headers["authorization"] = `Bearer ${this.token}`;
    try {
      const response = await this.httpClient.get(
        `${this.addresses.api}/releases?per_page=${PAGE_SIZE}&page=${page}`,
        headers,
      );
      if (response.message.statusCode !== 200) return undefined;
      return releaseListings(JSON.parse(await response.readBody()));
    } catch {
      return undefined;
    }
  }
}

// The releases of a page of GitHub's listing, or undefined when it is not one.
function releaseListings(page: unknown): readonly ReleaseListing[] | undefined {
  if (!Array.isArray(page)) return undefined;
  const listings = page.flatMap((release: unknown) => {
    if (typeof release !== "object" || release === null) return [];
    if (!("tag_name" in release && "draft" in release && "prerelease" in release)) return [];
    const { tag_name: tag, draft, prerelease } = release;
    return typeof tag === "string" && typeof draft === "boolean" && typeof prerelease === "boolean"
      ? [{ tag, draft, prerelease }]
      : [];
  });
  return listings.length === page.length ? listings : undefined;
}
