// Tests rules 2, 19 and 23 to 25: the publish and preview actions from their inputs to their end.

import assert from "node:assert/strict";
import { test } from "node:test";
import OPTIONS from "../../ghg-options.json" with { type: "json" };
import { runPreview, runPublish } from "../../src/services/running_site_actions.ts";
import { actionPorts } from "../support/action_ports.ts";
import { FakeRunner } from "../support/fakes.ts";
import { FakeRepository, FakeSiteBranch } from "../support/publishing_fakes.ts";

const SHARED = { to: "github-pages", branch: "gh-pages", token: "a-token" };

function ports(runner: FakeRunner) {
  const used = actionPorts(runner);
  const repository = new FakeRepository();
  const siteBranch = new FakeSiteBranch();
  used.files.texts.set("checkout-1/.nojekyll", "");
  return {
    ...used,
    repository,
    siteBranch,
    repositoryWith: (token: string) => {
      used.tokens.push(`repository ${token}`);
      return repository;
    },
    siteBranchWith: (token: string) => {
      used.tokens.push(`branch ${token}`);
      return siteBranch;
    },
  };
}

function pullRequest(action: string, headRepository = "owner/repo") {
  const repository = { full_name: "owner/repo" };
  return {
    name: "pull_request",
    refName: "12/merge",
    payload: { action, number: 12, pull_request: { head: { repo: { full_name: headRepository } } }, repository },
  };
}

test("publish and preview build only with ghg 1.1.0 or newer, and stop before installing an older one", async () => {
  const publishing = new FakeRunner({ ...SHARED, "ghg-version": "1.0.0" });
  publishing.event = { name: "push", refName: "main", payload: {} };
  await runPublish(OPTIONS, ports(publishing));
  const previewing = new FakeRunner({ ...SHARED, "ghg-version": "1.0.0" });
  previewing.event = pullRequest("opened");
  await runPreview(OPTIONS, ports(previewing));
  for (const runner of [publishing, previewing]) {
    assert.deepEqual(runner.failures, ["The action builds with ghg 1.1.0 or newer, not 1.0.0."]);
    assert.deepEqual(runner.path, []);
  }
});

test("publish and preview report every input the ghg named is too old for, after their own options", async () => {
  const newer = { ...OPTIONS, since: { ...OPTIONS.since, title: "1.2.0", "version-name": "1.2.0", "front-page": "1.2.0" } };
  const inputs = { ...SHARED, "ghg-version": "1.0.0", "keep-in-output": "\n/docs/\n", title: "Shop", "version-name": "latest" };
  const publishing = new FakeRunner(inputs);
  publishing.event = { name: "push", refName: "main", payload: {} };
  await runPublish(newer, ports(publishing));
  assert.deepEqual(publishing.failures, [
    "The action builds with ghg 1.2.0 or newer, not 1.0.0.",
    "keep-in-output needs ghg 1.1.0 or newer, not 1.0.0.",
    "title needs ghg 1.2.0 or newer, not 1.0.0.",
    "version-name needs ghg 1.2.0 or newer, not 1.0.0.",
  ]);
  const previewing = new FakeRunner(inputs);
  previewing.event = pullRequest("opened");
  await runPreview(newer, ports(previewing));
  assert.deepEqual(previewing.failures, [
    "The action builds with ghg 1.2.0 or newer, not 1.0.0.",
    "keep-in-output needs ghg 1.1.0 or newer, not 1.0.0.",
    "title needs ghg 1.2.0 or newer, not 1.0.0.",
  ]);
  assert.deepEqual(previewing.path, []);
});

test("publish installs ghg and publishes a version named by the branch, with the token the inputs give", async () => {
  const runner = new FakeRunner({ ...SHARED });
  runner.event = { name: "push", refName: "feature/login", payload: {} };
  const used = ports(runner);
  await runPublish(OPTIONS, used);
  assert.deepEqual(runner.failures, []);
  assert.deepEqual(runner.path, ["cache/1.2.0"]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the site's version feature-login"]);
  assert.deepEqual(used.tokens, ["repository a-token", "branch a-token", "a-token"]);
  assert.equal(runner.outputs.get("address"), "https://owner.github.io/repo/feature-login/");
});

test("publish names the version by version-name, on any event", async () => {
  const runner = new FakeRunner({ ...SHARED, "version-name": "latest" });
  runner.event = { name: "workflow_dispatch", refName: "main", payload: {} };
  const used = ports(runner);
  await runPublish(OPTIONS, used);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the site's version latest"]);
});

test("preview publishes a pull request's preview", async () => {
  const runner = new FakeRunner({ ...SHARED });
  runner.event = pullRequest("opened");
  const used = ports(runner);
  await runPreview(OPTIONS, used);
  assert.deepEqual(runner.failures, []);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the preview of pull request #12"]);
});

test("preview removes a closed pull request's preview without installing ghg", async () => {
  const runner = new FakeRunner({ ...SHARED });
  runner.event = pullRequest("closed");
  const used = ports(runner);
  await runPreview(OPTIONS, used);
  assert.deepEqual(runner.failures, []);
  assert.deepEqual(runner.path, []);
  assert.deepEqual(used.siteBranch.steps, ["check out", "remove previews/pr-12", "push Remove the preview of pull request #12"]);
});

test("preview on another event, or with changed-only neither true nor false, stops before anything is downloaded", async () => {
  const pushed = new FakeRunner({ ...SHARED });
  const pushedPorts = ports(pushed);
  await runPreview(OPTIONS, pushedPorts);
  assert.deepEqual(pushed.failures, ["preview acts on a pull request, not on push."]);
  assert.deepEqual(pushedPorts.tokens, []);
  const mistaken = new FakeRunner({ ...SHARED, "changed-only": "yes" });
  mistaken.event = pullRequest("opened");
  await runPreview(OPTIONS, ports(mistaken));
  assert.deepEqual(mistaken.failures, ["changed-only must be true or false."]);
});

test("preview on a pull request from a fork publishes nothing, with a notice, and installs nothing", async () => {
  const runner = new FakeRunner({ ...SHARED });
  runner.event = pullRequest("opened", "someone/repo");
  const used = ports(runner);
  await runPreview(OPTIONS, used);
  assert.deepEqual(runner.notices, ["This pull request comes from a fork, whose token cannot push, so its preview is not published."]);
  assert.deepEqual(runner.failures, []);
  assert.deepEqual(used.tokens, []);
  assert.deepEqual(used.siteBranch.steps, []);
});

test("a shared input that cannot be used stops either action before anything is downloaded", async () => {
  for (const run of [runPublish, runPreview]) {
    const runner = new FakeRunner({ ...SHARED, folder: "../site" });
    runner.event = pullRequest("opened");
    const used = ports(runner);
    await run(OPTIONS, used);
    assert.deepEqual(runner.failures, ["folder must be a folder of branch, such as features."]);
    assert.deepEqual(used.tokens, []);
  }
});

test("an error the action does not foresee says so", async () => {
  const runner = new FakeRunner({ ...SHARED });
  runner.event = { name: "pull_request", refName: "12/merge", payload: {} };
  await runPreview(OPTIONS, ports(runner));
  assert.deepEqual(runner.failures, ["The action failed unexpectedly: Error: the pull request's event has no number"]);
});
