// Adapter: the branch Pages serves, through the git the runner has, with @actions/exec.

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import type { PushOutcome, SiteBranch } from "../ports/site_branch.ts";

// The author of the action's commits, the user GitHub shows for the workflow's own token.
const AUTHOR_NAME = "github-actions[bot]";
const AUTHOR_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

export class GitSiteBranch implements SiteBranch {
  private readonly remote: string;
  /** The token goes as an extra header, as actions/checkout v7.0.1 sends it. */
  private readonly environment: Record<string, string>;
  private readonly temporaryRoot: string;
  private readonly repositories = new Map<string, string>();

  /** serverAddress is GITHUB_SERVER_URL, such as https://github.com, and repository GITHUB_REPOSITORY, such as owner/repo. */
  constructor(serverAddress: string, repository: string, token: string, temporaryRoot = os.tmpdir()) {
    this.remote = `${serverAddress}/${repository}.git`;
    this.temporaryRoot = temporaryRoot;
    const credentials = Buffer.from(`x-access-token:${token}`).toString("base64");
    core.setSecret(credentials);
    // In the environment, which git 2.31 and later read and no process list shows, after the entries an earlier step gave there.
    const inherited = Object.fromEntries(
      Object.entries(process.env).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
    );
    const given = Number.parseInt(inherited["GIT_CONFIG_COUNT"] ?? "", 10);
    const index = Number.isInteger(given) && given > 0 ? given : 0;
    this.environment = {
      ...inherited,
      GIT_CONFIG_COUNT: String(index + 1),
      [`GIT_CONFIG_KEY_${index}`]: `http.${serverAddress}/.extraheader`,
      [`GIT_CONFIG_VALUE_${index}`]: `AUTHORIZATION: basic ${credentials}`,
      GIT_TERMINAL_PROMPT: "0",
    };
  }

  // From an empty checkout, since in the workspace git would also send the extra header actions/checkout leaves there.
  async exists(branch: string): Promise<boolean> {
    const listed = await this.git(await this.emptyCheckout(), ["ls-remote", "--heads", this.remote, `refs/heads/${branch}`]);
    return listed.stdout.trim() !== "";
  }

  async make(branch: string): Promise<boolean> {
    const checkout = await this.emptyCheckout();
    await this.git(checkout, ["symbolic-ref", "HEAD", `refs/heads/${branch}`]);
    await this.git(checkout, ["commit", "--quiet", "--allow-empty", "-m", "Make the branch GitHub Pages serves"]);
    const pushed = await this.git(checkout, ["push", "--quiet", this.remote, `HEAD:refs/heads/${branch}`], true);
    if (pushed.exitCode !== 0) core.info(`git push failed: ${pushed.stderr.trim()}`);
    return pushed.exitCode === 0;
  }

  async checkOut(branch: string): Promise<string> {
    const checkout = await this.emptyCheckout();
    await this.git(checkout, ["fetch", "--quiet", "--depth=1", this.remote, `refs/heads/${branch}`]);
    await this.git(checkout, ["checkout", "--quiet", "--force", "-B", branch, "FETCH_HEAD"]);
    return checkout;
  }

  async removeFolder(checkout: string, folder: string): Promise<void> {
    await rm(path.join(checkout, ...folder.split("/")), { recursive: true, force: true });
  }

  async commitAndPush(checkout: string, branch: string, message: string): Promise<PushOutcome> {
    await this.git(checkout, ["add", "--all"]);
    const staged = await this.git(checkout, ["diff", "--cached", "--quiet"], true);
    if (staged.exitCode === 0) return "unchanged";
    await this.git(checkout, ["commit", "--quiet", "-m", message]);
    const pushed = await this.git(checkout, ["push", "--quiet", this.remote, `HEAD:refs/heads/${branch}`], true);
    if (pushed.exitCode === 0) return "pushed";
    // git push says "[rejected]" with "fetch first" or "non-fast-forward" when the branch moved on.
    if (/\[rejected\]|fetch first|non-fast-forward/.test(pushed.stderr)) return "behind";
    core.info(`git push failed: ${pushed.stderr.trim()}`);
    return "refused";
  }

  // The repository is kept beside the work tree, since ghg refuses an output folder that holds anything it did not write.
  private async emptyCheckout(): Promise<string> {
    const root = await mkdtemp(path.join(this.temporaryRoot, "ghg-pages-"));
    const checkout = path.join(root, "site");
    await mkdir(checkout);
    await this.git(undefined, ["init", "--quiet", "--bare", path.join(root, "repository")]);
    this.repositories.set(checkout, path.join(root, "repository"));
    for (const [key, value] of [
      ["core.bare", "false"],
      // The files are published as ghg writes them, whatever the runner's system.
      ["core.autocrlf", "false"],
      ["user.name", AUTHOR_NAME],
      ["user.email", AUTHOR_EMAIL],
    ]) {
      await this.git(checkout, ["config", key, value]);
    }
    return checkout;
  }

  // Never in the workspace, whose repository's configuration git would read; a failure throws unless it is allowed.
  private async git(checkout: string | undefined, gitArguments: readonly string[], failureAllowed = false) {
    const repository = checkout === undefined ? undefined : this.repositories.get(checkout);
    const located = repository === undefined ? [] : [`--git-dir=${repository}`, `--work-tree=${checkout}`];
    const result = await getExecOutput("git", [...located, ...gitArguments], {
      ignoreReturnCode: true,
      silent: true,
      env: this.environment,
      cwd: this.temporaryRoot,
    });
    if (result.exitCode !== 0 && !failureAllowed) {
      throw new Error(`git ${gitArguments[0] ?? ""} failed: ${result.stderr.trim()}`);
    }
    return result;
  }
}
