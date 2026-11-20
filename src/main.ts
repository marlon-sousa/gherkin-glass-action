// Composition root: the action, wired to the runner.

import pairedGhg from "../paired-ghg.json" with { type: "json" };
import { ActionsRunner } from "./adapters/actions_runner.ts";
import { ActionsToolCache } from "./adapters/actions_tool_cache.ts";
import { ExecGhgProcess } from "./adapters/exec_ghg_process.ts";
import { GitSiteBranch } from "./adapters/git_site_branch.ts";
import { GITHUB_RELEASES, GitHubGhgReleases } from "./adapters/github_releases.ts";
import { GitHubRepositoryApi } from "./adapters/github_repository_api.ts";
import { NodeFiles } from "./adapters/node_files.ts";
import { majorOf } from "./policies/versions.ts";
import { runAction } from "./services/running_action.ts";

// runAction fails the step itself, so its promise never rejects.
void runAction(majorOf(pairedGhg.version), {
  runner: new ActionsRunner(),
  releasesWith: (token) => new GitHubGhgReleases(GITHUB_RELEASES, token),
  toolCache: new ActionsToolCache(),
  files: new NodeFiles(),
  process: new ExecGhgProcess(),
  repositoryWith: (token) =>
    new GitHubRepositoryApi(process.env["GITHUB_API_URL"] ?? "https://api.github.com", process.env["GITHUB_REPOSITORY"] ?? "", token),
  siteBranchWith: (token) =>
    new GitSiteBranch(
      process.env["GITHUB_SERVER_URL"] ?? "https://github.com",
      process.env["GITHUB_REPOSITORY"] ?? "",
      token,
      process.env["RUNNER_TEMP"],
    ),
});
