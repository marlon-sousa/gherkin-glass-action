// Tests docs/BEHAVIOUR.md, rules 21 to 26: publishing on the branch Pages serves, with fakes of the ports.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import type { PublishTarget } from "../../src/policies/workflow_event.ts";
import type { PushOutcome } from "../../src/ports/site_branch.ts";
import { publishSite } from "../../src/services/publishing.ts";
import { FakeFiles, FakeGhgProcess, FakeRunner } from "../support/fakes.ts";
import { FakeRepository, FakeSiteBranch, PAGES } from "../support/publishing_fakes.ts";

type Published = Exclude<PublishTarget, { readonly kind: "fork" }>;

const VERSION: Published = { kind: "version", versionName: "v1.2.0", folder: "features" };
const PREVIEW: Published = { kind: "preview", pullRequest: 12, folder: "previews/pr-12" };
const REMOVAL: Published = { kind: "removal", pullRequest: 12, folder: "previews/pr-12" };
const PREVIEW_COMMENT =
  "<!-- gherkin-glass-action preview -->\nThe preview of this pull request's feature files is at https://owner.github.io/repo/previews/pr-12/.";

function publishing(
  target: Published,
  outcomes: PushOutcome[] = ["pushed"],
  repository = new FakeRepository(),
  changedOnly = false,
) {
  const runner = new FakeRunner();
  const used = {
    runner,
    repository,
    siteBranch: new FakeSiteBranch(outcomes),
    process: new FakeGhgProcess(),
    files: new FakeFiles(),
  };
  const request = {
    branch: "gh-pages",
    folder: target.kind === "version" ? "features" : "",
    changedOnly,
    target,
    token: "a-token",
    build: { buildArguments: ["--title=T"], input: "", frontPage: "", configFile: "ghg.toml" },
  };
  return { used, run: () => publishSite("ghg", request, used) };
}

async function stops(run: () => Promise<void>, message: string) {
  await assert.rejects(run, (error) => error instanceof ActionStop && error.message === message);
}

test("a push adds a versioned build to publish-folder, and says where it is published", async () => {
  const { used, run } = publishing(VERSION);
  await run();
  assert.deepEqual(used.process.runs, [
    ["ghg", "build", "--title=T", `--output=${path.join("checkout-1", "features")}`, "--version-name=v1.2.0"],
  ]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the site's version v1.2.0"]);
  assert.deepEqual(used.runner.logged, ["The site is published on gh-pages, at https://owner.github.io/repo/features/v1.2.0/."]);
  assert.deepEqual(used.repository.written, []);
});

test("a pull request's preview is built with --preview into its folder, and its address commented", async () => {
  const { used, run } = publishing(PREVIEW);
  await run();
  assert.deepEqual(used.process.runs, [
    ["ghg", "build", "--title=T", `--output=${path.join("checkout-1", "previews", "pr-12")}`, "--preview"],
  ]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the preview of pull request #12"]);
  assert.deepEqual(used.repository.written, [`add 12: ${PREVIEW_COMMENT}`]);
});

test("the comment is edited on a later push, and left alone when it already says the same", async () => {
  const repository = new FakeRepository();
  repository.comments = [{ id: 7, body: "<!-- gherkin-glass-action preview -->\nAn older address." }];
  await publishing(PREVIEW, ["pushed"], repository).run();
  assert.deepEqual(repository.written, [`edit 7: ${PREVIEW_COMMENT}`]);
  repository.comments = [{ id: 7, body: PREVIEW_COMMENT }];
  repository.written.length = 0;
  await publishing(PREVIEW, ["unchanged"], repository).run();
  assert.deepEqual(repository.written, []);
});

test("a closed pull request's preview is removed, and its comment edited to say so", async () => {
  const repository = new FakeRepository();
  repository.comments = [{ id: 7, body: PREVIEW_COMMENT }];
  const { used, run } = publishing(REMOVAL, ["pushed"], repository);
  await run();
  assert.deepEqual(used.process.runs, []);
  assert.deepEqual(used.siteBranch.steps, ["check out", "remove previews/pr-12", "push Remove the preview of pull request #12"]);
  assert.deepEqual(used.runner.logged, ["The preview of pull request #12 is removed from gh-pages."]);
  assert.deepEqual(repository.written, [
    "edit 7: <!-- gherkin-glass-action preview -->\nThe preview of this pull request was removed when it closed.",
  ]);
});

test("a removal without a comment of the action's adds none", async () => {
  const { used, run } = publishing(REMOVAL, ["unchanged"]);
  await run();
  assert.deepEqual(used.repository.written, []);
});

test("a site already published makes no commit, and says so", async () => {
  const { used, run } = publishing(VERSION, ["unchanged"]);
  await run();
  assert.deepEqual(used.runner.logged, ["The site on gh-pages is already up to date."]);
});

test("another push first starts again from the branch's newest commit, three times in all", async () => {
  const { used, run } = publishing(VERSION, ["behind", "pushed"]);
  await run();
  assert.equal(used.process.runs.length, 2);
  assert.equal(used.process.runs[1]?.[3], `--output=${path.join("checkout-2", "features")}`);
  await stops(publishing(VERSION, ["behind", "behind", "behind"]).run, "The site cannot be pushed to gh-pages.");
  await stops(
    publishing(VERSION, ["refused"]).run,
    "The site cannot be pushed to gh-pages: the workflow needs the permission contents: write.",
  );
});

test("Pages that does not deploy from the branch stops the action, after making the branch when it is missing", async () => {
  const off = publishing(VERSION, [], new FakeRepository("off"));
  await stops(
    off.run,
    'Pages does not deploy from the branch gh-pages: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages.',
  );
  assert.deepEqual(off.used.siteBranch.steps, []);
  const missing = publishing(VERSION, [], new FakeRepository({ ...PAGES, buildType: "workflow" }));
  missing.used.siteBranch.branchExists = false;
  await stops(
    missing.run,
    'The branch gh-pages is made: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages.',
  );
  assert.deepEqual(missing.used.siteBranch.steps, ["make"]);
});

test("Pages serving a folder without publish-folder, or unreadable, stops the action before anything is built", async () => {
  const outside = publishing(VERSION, [], new FakeRepository({ ...PAGES, path: "/docs" }));
  await stops(outside.run, "Pages serves the folder /docs of gh-pages, so publish-folder must be in it.");
  assert.deepEqual(outside.used.process.runs, []);
  const unreadable = new FakeRepository();
  unreadable.pages = undefined;
  await stops(
    publishing(VERSION, [], unreadable).run,
    "The settings of Pages cannot be read: the workflow needs the permission pages: read.",
  );
});

test("a comment that cannot be written stops the action", async () => {
  const repository = new FakeRepository();
  repository.writable = false;
  await stops(publishing(PREVIEW, ["pushed"], repository).run, "The comment of the pull request's preview cannot be written.");
  repository.comments = undefined;
  await stops(publishing(PREVIEW, ["pushed"], repository).run, "The comment of the pull request's preview cannot be written.");
});

test("changed-only gives ghg the changed files of the input folder, or publishes nothing without one", async () => {
  const repository = new FakeRepository();
  repository.changedFiles = [
    { path: "features/a.feature", removed: false },
    { path: "src/main.rs", removed: false },
  ];
  const narrowed = publishing(PREVIEW, ["pushed"], repository, true);
  await narrowed.run();
  assert.deepEqual(narrowed.used.process.runs[0]?.slice(-1), ["--only=temporary/changed-files.txt"]);
  assert.equal(narrowed.used.files.texts.get("temporary/changed-files.txt"), "features/a.feature\n");
  repository.changedFiles = [{ path: "features/a.feature", removed: true }];
  const none = publishing(PREVIEW, ["pushed"], repository, true);
  await none.run();
  assert.deepEqual(none.used.runner.logged, ["This pull request changes no file of the input folder, so no preview is published."]);
  assert.deepEqual(none.used.siteBranch.steps, []);
  repository.changedFiles = undefined;
  await stops(publishing(PREVIEW, ["pushed"], repository, true).run, "The files the pull request changes cannot be listed.");
});

test("changed-only changes nothing on a push, or when a pull request closes", async () => {
  for (const target of [VERSION, REMOVAL]) {
    const repository = new FakeRepository();
    repository.changedFiles = undefined;
    const { used, run } = publishing(target, ["pushed"], repository, true);
    await run();
    assert.equal(used.siteBranch.steps.length, target.kind === "version" ? 2 : 3);
    assert.equal(used.process.runs[0]?.some((argument) => argument.startsWith("--only")) ?? false, false);
  }
});
