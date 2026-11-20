// Tests docs/BEHAVIOUR.md, rules 20 to 22: whether Pages serves the branch, and the address of a folder of it.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressOf,
  folderOutsideProblem,
  jekyllProblem,
  noJekyllFileOf,
  notFromBranchProblem,
  pagesReadinessOf,
  type PagesSettings,
} from "../../src/policies/pages_source.ts";

const SETTINGS: PagesSettings = { buildType: "legacy", branch: "gh-pages", path: "/", address: "https://owner.github.io/repo/" };

test("Pages deploying the root of the branch is ready for any folder", () => {
  assert.deepEqual(pagesReadinessOf(SETTINGS, "gh-pages", "features"), {
    kind: "ready",
    servedFolder: "",
    address: "https://owner.github.io/repo/",
  });
});

test("Pages that is off, deploys an artifact, or serves another branch, does not deploy from the branch", () => {
  assert.deepEqual(pagesReadinessOf(undefined, "gh-pages", ""), { kind: "not-from-branch" });
  assert.deepEqual(pagesReadinessOf({ ...SETTINGS, buildType: "workflow" }, "gh-pages", ""), { kind: "not-from-branch" });
  assert.deepEqual(pagesReadinessOf({ ...SETTINGS, branch: "main" }, "gh-pages", ""), { kind: "not-from-branch" });
});

test("Pages serving a folder must hold folder", () => {
  const docs = { ...SETTINGS, path: "/docs" };
  assert.equal(pagesReadinessOf(docs, "gh-pages", "docs").kind, "ready");
  assert.equal(pagesReadinessOf(docs, "gh-pages", "docs/features").kind, "ready");
  assert.deepEqual(pagesReadinessOf(docs, "gh-pages", "documents"), { kind: "folder-outside", servedFolder: "/docs" });
  assert.deepEqual(pagesReadinessOf(docs, "gh-pages", ""), { kind: "folder-outside", servedFolder: "/docs" });
});

test("the sentences name the branch and the folder", () => {
  assert.equal(
    notFromBranchProblem("gh-pages", false),
    'Pages does not deploy from the branch gh-pages: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages.',
  );
  assert.equal(
    notFromBranchProblem("gh-pages", true),
    'The branch gh-pages is made: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages, and add an empty .nojekyll file at its root.',
  );
  assert.equal(folderOutsideProblem("/docs", "gh-pages"), "Pages serves the folder /docs of gh-pages, so folder must be in it.");
  assert.equal(
    jekyllProblem("docs", "gh-pages"),
    "Pages runs Jekyll on gh-pages, which leaves out pages whose names start with _: add an empty .nojekyll file to the folder /docs of gh-pages.",
  );
  assert.equal(
    jekyllProblem("", "gh-pages"),
    "Pages runs Jekyll on gh-pages, which leaves out pages whose names start with _: add an empty .nojekyll file to the folder / of gh-pages.",
  );
});

test(".nojekyll is at the root of the folder Pages serves", () => {
  assert.equal(noJekyllFileOf(""), ".nojekyll");
  assert.equal(noJekyllFileOf("docs"), "docs/.nojekyll");
});

test("a folder's address is its path below the folder Pages serves", () => {
  const root = { servedFolder: "", address: "https://owner.github.io/repo/" };
  assert.equal(addressOf(root, "features/previews/pr-12"), "https://owner.github.io/repo/features/previews/pr-12/");
  assert.equal(addressOf(root, ""), "https://owner.github.io/repo/");
  const docs = { servedFolder: "docs", address: "https://example.org" };
  assert.equal(addressOf(docs, "docs/v1.2.0"), "https://example.org/v1.2.0/");
});
