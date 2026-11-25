// Composition root: the root action, wired to the runner.

import ghgOptions from "../ghg-options.json" with { type: "json" };
import { ActionsRunner } from "./adapters/actions_runner.ts";
import { ActionsToolCache } from "./adapters/actions_tool_cache.ts";
import { ExecGhgProcess } from "./adapters/exec_ghg_process.ts";
import { GITHUB_RELEASES, GitHubGhgReleases } from "./adapters/github_releases.ts";
import { NodeFiles } from "./adapters/node_files.ts";
import { runAction } from "./services/running_action.ts";

void runAction(ghgOptions, {
  runner: new ActionsRunner(),
  releasesWith: (token) => new GitHubGhgReleases(GITHUB_RELEASES, token),
  toolCache: new ActionsToolCache(),
  files: new NodeFiles(),
  process: new ExecGhgProcess(),
});
