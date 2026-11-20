// Tests docs/BEHAVIOUR.md, rules 28 and 29: which files a pull request changes matter to its preview.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { changesPreviewSources, filesToPreview } from "../../src/policies/changed_files.ts";

const WORKSPACE = path.resolve("/work");
const CHANGED = [
  { path: "features/shop/basket.feature", removed: false },
  { path: "features/shop/old.feature", removed: true },
  { path: "features/README.md", removed: false },
  { path: "src/main.rs", removed: false },
  { path: "features-old/a.feature", removed: false },
];

test("the files kept are those inside the input folder that the pull request does not remove", () => {
  assert.deepEqual(filesToPreview(CHANGED, "features", WORKSPACE), ["features/shop/basket.feature", "features/README.md"]);
  assert.deepEqual(filesToPreview(CHANGED, "./features/shop/", WORKSPACE), ["features/shop/basket.feature"]);
});

test("an input folder given as a whole path is compared from the workspace", () => {
  assert.deepEqual(filesToPreview(CHANGED, path.join(WORKSPACE, "src"), WORKSPACE), ["src/main.rs"]);
});

test("a pull request that changes nothing in the input folder keeps nothing", () => {
  assert.deepEqual(filesToPreview(CHANGED, "specs", WORKSPACE), []);
});

test("commits change the preview's sources when they touch the input folder, the configuration or the front page", () => {
  const paths = { inputFolder: "features", workspaceFiles: ["ghg.toml", "docs/front.md"] };
  const changes = (file: string, removed = false) => changesPreviewSources([{ path: file, removed }], paths, WORKSPACE);
  assert.equal(changes("features/a.feature"), true);
  assert.equal(changes("features/a.feature", true), true);
  assert.equal(changes("ghg.toml"), true);
  assert.equal(changes("docs/front.md"), true);
  assert.equal(changes("src/main.rs"), false);
  assert.equal(changes("features-old/a.feature"), false);
  assert.equal(changesPreviewSources([], paths, WORKSPACE), false);
});
