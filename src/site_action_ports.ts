// Composition root: the adapters the publish and preview actions run with, which src/publish_main.ts and src/preview_main.ts share.

import { ActionsRunner } from "./adapters/actions_runner.ts";
import { ActionsToolCache } from "./adapters/actions_tool_cache.ts";
import { ExecGhgProcess } from "./adapters/exec_ghg_process.ts";
import { GitSiteBranch } from "./adapters/git_site_branch.ts";
import { GITHUB_RELEASES, GitHubGhgReleases } from "./adapters/github_releases.ts";
import { gitHubClientOf, GitHubRepositoryApi } from "./adapters/github_repository_api.ts";
import { NodeFiles } from "./adapters/node_files.ts";
import type { SiteActionPorts } from "./services/running_site_actions.ts";

/** The adapters, reaching GitHub on the workflow's own server, GITHUB_SERVER_URL and GITHUB_API_URL. */
export function siteActionPorts(): SiteActionPorts {
  return {
    runner: new ActionsRunner(),
    releasesWith: (token) => new GitHubGhgReleases(GITHUB_RELEASES, token),
    toolCache: new ActionsToolCache(),
    files: new NodeFiles(),
    process: new ExecGhgProcess(),
    repositoryWith: (token) =>
      new GitHubRepositoryApi(
        gitHubClientOf(process.env["GITHUB_API_URL"] ?? "https://api.github.com", token),
        process.env["GITHUB_REPOSITORY"] ?? "",
      ),
    siteBranchWith: (token) =>
      new GitSiteBranch(
        process.env["GITHUB_SERVER_URL"] ?? "https://github.com",
        process.env["GITHUB_REPOSITORY"] ?? "",
        token,
        process.env["RUNNER_TEMP"],
      ),
  };
}
