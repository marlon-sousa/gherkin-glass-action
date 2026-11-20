// Tests docs/BEHAVIOUR.md, rules 20 and 22: the branch Pages serves, against a repository on disk.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { GitSiteBranch } from "../../src/adapters/git_site_branch.ts";

let root: string;
let siteBranch: GitSiteBranch;
let remote: string;

function gitOutput(...gitArguments: string[]): string {
  return execFileSync("git", ["--git-dir", remote, ...gitArguments], { encoding: "utf8" });
}

function git(...gitArguments: string[]): string {
  return gitOutput(...gitArguments).trim();
}

before(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "site-branch-"));
  remote = path.join(root, "server", "owner", "repo.git");
  mkdirSync(remote, { recursive: true });
  execFileSync("git", ["init", "--quiet", "--bare", remote]);
  // The server's address and the repository make the remote's, as GITHUB_SERVER_URL and GITHUB_REPOSITORY do.
  siteBranch = new GitSiteBranch(pathToFileURL(path.join(root, "server")).href, "owner/repo", "a-token", root);
});

after(() => rmSync(root, { recursive: true, force: true }));

test("a branch that does not exist is told, made with one empty commit, and then exists", async () => {
  // The working folder is the workspace, whose repository actions/checkout configures: here, it
  // would send the remote elsewhere, if git read it.
  const workspace = path.join(root, "workspace");
  execFileSync("git", ["init", "--quiet", workspace]);
  execFileSync("git", ["-C", workspace, "config", `url.${path.join(root, "nowhere")}.insteadOf`, pathToFileURL(root).href]);
  const workingFolder = process.cwd();
  process.chdir(workspace);
  try {
    assert.equal(await siteBranch.exists("gh-pages"), false);
  } finally {
    process.chdir(workingFolder);
  }
  assert.equal(await siteBranch.make("gh-pages"), true);
  assert.equal(await siteBranch.exists("gh-pages"), true);
  assert.equal(git("rev-list", "--count", "gh-pages"), "1");
  assert.equal(git("log", "-1", "--format=%an <%ae>", "gh-pages"), "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>");
});

test("a checkout holds the branch's files and no .git, and what changes in it is pushed", async () => {
  const checkout = await siteBranch.checkOut("gh-pages");
  assert.deepEqual(readdirSync(checkout), []);
  mkdirSync(path.join(checkout, "previews", "pr-12"), { recursive: true });
  writeFileSync(path.join(checkout, "previews", "pr-12", "index.html"), "a page\r\n");
  assert.equal(await siteBranch.commitAndPush(checkout, "gh-pages", "Publish the preview of pull request #12"), "pushed");
  assert.equal(git("log", "-1", "--format=%s", "gh-pages"), "Publish the preview of pull request #12");
  // The file is published as it was written, whatever the system's line endings.
  assert.equal(gitOutput("cat-file", "-p", "gh-pages:previews/pr-12/index.html"), "a page\r\n");
});

test("nothing changed makes no commit", async () => {
  const checkout = await siteBranch.checkOut("gh-pages");
  assert.deepEqual(readdirSync(checkout), ["previews"]);
  assert.equal(await siteBranch.commitAndPush(checkout, "gh-pages", "Nothing"), "unchanged");
  assert.equal(git("rev-list", "--count", "gh-pages"), "2");
});

test("a removed folder is pushed removed, and a push after another's is behind", async () => {
  const late = await siteBranch.checkOut("gh-pages");
  const first = await siteBranch.checkOut("gh-pages");
  await siteBranch.removeFolder(first, "previews/pr-12");
  assert.equal(existsSync(path.join(first, "previews", "pr-12")), false);
  assert.equal(await siteBranch.commitAndPush(first, "gh-pages", "Remove the preview of pull request #12"), "pushed");
  assert.equal(git("ls-tree", "-r", "--name-only", "gh-pages"), "");
  writeFileSync(path.join(late, "late.html"), "late");
  assert.equal(await siteBranch.commitAndPush(late, "gh-pages", "Too late"), "behind");
});

test("a push the server refuses for another reason than being behind is refused", async () => {
  const checkout = await siteBranch.checkOut("gh-pages");
  writeFileSync(path.join(remote, "hooks", "pre-receive"), "#!/bin/sh\necho permission denied >&2\nexit 1\n", { mode: 0o755 });
  writeFileSync(path.join(checkout, "refused.html"), "refused");
  assert.equal(await siteBranch.commitAndPush(checkout, "gh-pages", "Refused"), "refused");
  assert.equal(await siteBranch.make("site"), false);
});
