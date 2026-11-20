// Tests docs/BEHAVIOUR.md, rule 26: the files of a pull request that its preview shows.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { filesToPreview } from "../../src/policies/changed_files.ts";

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
