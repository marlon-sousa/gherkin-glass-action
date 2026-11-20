// Tests docs/BEHAVIOUR.md, rules 26 to 29: preview publishes a pull request's preview, and removes it once closed.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import type { PushOutcome } from "../../src/ports/site_branch.ts";
import { publishPreview, removePreview, type OpenPullRequest } from "../../src/services/publishing_preview.ts";
import { FakeRepository, publishingPorts, siteRequest } from "../support/publishing_fakes.ts";

const OPENED: OpenPullRequest = { kind: "open", pullRequest: 12, headCommit: undefined };
const PUSHED: OpenPullRequest = { kind: "open", pullRequest: 12, headCommit: "bbb" };
const ADDRESS = "https://owner.github.io/repo/previews/pr-12/";
const PREVIEW_COMMENT = `<!-- gherkin-glass-action preview -->\nThe preview of this pull request's feature files is at ${ADDRESS}.`;
const MARKER = "previews/pr-12/ghg-site.json";
const BUILT_FROM_AAA = PREVIEW_COMMENT.replace("\n", "\n<!-- built from aaa -->\n");

/** A repository whose comment says the preview was built from aaa, and whose comparison of aaa with the head gives those files. */
function builtFromAaa(compared: FakeRepository["comparedFiles"]): FakeRepository {
  const repository = new FakeRepository();
  repository.comments = [{ id: 7, body: BUILT_FROM_AAA }];
  repository.comparedFiles = compared;
  return repository;
}

function previewing(
  event: OpenPullRequest | "closed",
  options: { outcomes?: PushOutcome[]; repository?: FakeRepository; changedOnly?: boolean; onBranch?: string[] } = {},
) {
  const used = publishingPorts(options.outcomes, options.repository, [".nojekyll", ...(options.onBranch ?? [])]);
  const request = { ...siteRequest(), changedOnly: options.changedOnly ?? false };
  return {
    used,
    run: () => (event === "closed" ? removePreview(12, request, used) : publishPreview("ghg", request, event, used)),
  };
}

async function stops(run: () => Promise<void>, message: string) {
  await assert.rejects(run, (error) => error instanceof ActionStop && error.message === message);
}

test("a pull request's preview is built with --preview into its folder, and its address commented", async () => {
  const { used, run } = previewing(OPENED);
  await run();
  assert.deepEqual(used.process.runs, [
    ["ghg", "build", "--title=T", `--output=${path.join("checkout-1", "previews", "pr-12")}`, "--preview"],
  ]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the preview of pull request #12"]);
  assert.deepEqual(used.runner.logged, [`The site is published on gh-pages, at ${ADDRESS}.`]);
  assert.equal(used.runner.outputs.get("address"), ADDRESS);
  assert.deepEqual(used.repository.written, [`add 12: ${PREVIEW_COMMENT}`]);
});

test("the comment is edited on a later push, and left alone when it already says the same", async () => {
  const repository = new FakeRepository();
  repository.comments = [{ id: 7, body: "<!-- gherkin-glass-action preview -->\nAn older address." }];
  await previewing(OPENED, { repository }).run();
  assert.deepEqual(repository.written, [`edit 7: ${PREVIEW_COMMENT}`]);
  repository.comments = [{ id: 7, body: PREVIEW_COMMENT }];
  repository.written.length = 0;
  await previewing(OPENED, { outcomes: ["unchanged"], repository }).run();
  assert.deepEqual(repository.written, []);
});

test("a comment that cannot be written stops the action", async () => {
  const repository = new FakeRepository();
  repository.writable = false;
  await stops(previewing(OPENED, { repository }).run, "The comment of the pull request's preview cannot be written.");
  repository.comments = undefined;
  await stops(previewing(OPENED, { repository }).run, "The comment of the pull request's preview cannot be written.");
});

test("a closed pull request's preview is removed, and its comment edited to say so", async () => {
  const repository = new FakeRepository();
  repository.comments = [{ id: 7, body: PREVIEW_COMMENT }];
  const { used, run } = previewing("closed", { repository });
  await run();
  assert.deepEqual(used.process.runs, []);
  assert.deepEqual(used.siteBranch.steps, ["check out", "remove previews/pr-12", "push Remove the preview of pull request #12"]);
  assert.deepEqual(used.runner.logged, ["The preview of pull request #12 is removed from gh-pages."]);
  assert.deepEqual(repository.written, [
    "edit 7: <!-- gherkin-glass-action preview -->\nThe preview of this pull request was removed when it closed.",
  ]);
});

test("a removal without a comment of the action's adds none", async () => {
  const { used, run } = previewing("closed", { outcomes: ["unchanged"] });
  await run();
  assert.deepEqual(used.repository.written, []);
});

test("changed-only gives ghg the changed files of the input folder, or publishes nothing without one", async () => {
  const repository = new FakeRepository();
  repository.changedFiles = [
    { path: "features/a.feature", removed: false },
    { path: "src/main.rs", removed: false },
  ];
  const narrowed = previewing(OPENED, { repository, changedOnly: true });
  await narrowed.run();
  assert.deepEqual(narrowed.used.process.runs[0]?.slice(-1), ["--only=temporary/changed-files.txt"]);
  assert.equal(narrowed.used.files.texts.get("temporary/changed-files.txt"), "features/a.feature\n");
  repository.changedFiles = [{ path: "features/a.feature", removed: true }];
  const none = previewing(OPENED, { repository, changedOnly: true });
  await none.run();
  assert.deepEqual(none.used.runner.logged, ["This pull request changes no file of the input folder, so no preview is published."]);
  assert.deepEqual(none.used.siteBranch.steps, []);
  repository.changedFiles = undefined;
  await stops(previewing(OPENED, { repository, changedOnly: true }).run, "The files the pull request changes cannot be listed.");
});

test("changed-only changes nothing when a pull request closes", async () => {
  const repository = new FakeRepository();
  repository.changedFiles = undefined;
  const { used, run } = previewing("closed", { repository, changedOnly: true });
  await run();
  assert.equal(used.siteBranch.steps.length, 3);
});

test("a head that changes no file the preview is built from, since the commit it was built from, leaves the preview as it is", async () => {
  const repository = builtFromAaa([{ path: "src/main.rs", removed: false }]);
  const { used, run } = previewing(PUSHED, { repository, onBranch: [MARKER] });
  await run();
  assert.deepEqual(used.process.runs, []);
  assert.deepEqual(used.siteBranch.steps, ["check out"]);
  assert.deepEqual(used.runner.logged, [
    "The commits since the preview was built change no file it is built from, so the preview is left as it is.",
  ]);
  assert.equal(used.runner.outputs.get("address"), ADDRESS);
  assert.deepEqual(repository.written, [`edit 7: ${BUILT_FROM_AAA.replace("aaa", "bbb")}`]);
});

test("the preview is built all the same when a source changed, it is missing, the commits cannot be compared or no commit is known", async () => {
  const cases = [
    { repository: builtFromAaa([{ path: "ghg.toml", removed: false }]), onBranch: [MARKER], event: PUSHED },
    { repository: builtFromAaa([]), onBranch: [], event: PUSHED },
    { repository: builtFromAaa(undefined), onBranch: [MARKER], event: PUSHED },
    { repository: builtFromAaa([]), onBranch: [MARKER], event: OPENED },
    { repository: new FakeRepository(), onBranch: [MARKER], event: PUSHED },
  ];
  for (const { repository, onBranch, event } of cases) {
    const { used, run } = previewing(event, { repository, onBranch });
    await run();
    assert.equal(used.process.runs.length, 1);
  }
});
