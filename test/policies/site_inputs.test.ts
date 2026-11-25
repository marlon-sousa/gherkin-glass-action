// Tests rules 19 and 28: the inputs the publish and preview actions share, and those of each action.yml.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { changedOnlyOf, previewFolderOf, siteInputsOf } from "../../src/policies/site_inputs.ts";

const DEFAULTS = { to: "github-pages", branch: "gh-pages", folder: "" };

function inputsOf(inputs: Record<string, string>) {
  return siteInputsOf((name) => inputs[name] ?? "");
}

function inputsOfActionYml(folder: string): string[] {
  const actionYml = readFileSync(new URL(`../../${folder}/action.yml`, import.meta.url), "utf8");
  const inputsSection = actionYml.split(/^inputs:$/m)[1]?.split(/^\S/m)[0] ?? "";
  return [...inputsSection.matchAll(/^ {2}([a-z-]+):$/gm)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

test("the inputs name the branch and the folder, without the / that may end it", () => {
  assert.deepEqual(inputsOf(DEFAULTS), { branch: "gh-pages", folder: "" });
  assert.deepEqual(inputsOf({ ...DEFAULTS, branch: "site", folder: "docs/features/" }), {
    branch: "site",
    folder: "docs/features",
  });
});

test("each input that cannot be used stops the action", () => {
  assert.deepEqual(inputsOf({ ...DEFAULTS, to: "s3" }), { problem: "to must be github-pages." });
  assert.deepEqual(inputsOf({ ...DEFAULTS, branch: "" }), { problem: "branch must name a branch." });
  for (const folder of ["/", "/features", "C:/site", "a//b", "./features", "a/../b", "..", "a\\b"]) {
    assert.deepEqual(
      inputsOf({ ...DEFAULTS, folder }),
      { problem: "folder must be a folder of branch, such as features." },
      folder,
    );
  }
});

test("changed-only is true or false, false when empty", () => {
  assert.equal(changedOnlyOf("true"), true);
  assert.equal(changedOnlyOf("false"), false);
  assert.equal(changedOnlyOf(""), false);
  assert.deepEqual(changedOnlyOf("yes"), { problem: "changed-only must be true or false." });
});

test("a preview goes into previews/pr-<number> of folder", () => {
  assert.equal(previewFolderOf("", 12), "previews/pr-12");
  assert.equal(previewFolderOf("docs/features", 12), "docs/features/previews/pr-12");
});

test("each action.yml takes the shared inputs, and its own", () => {
  const shared = ["to", "branch", "folder", "ghg-version", "token", "config", "input", "title", "front-page", "keep-in-output"];
  assert.deepEqual(inputsOfActionYml("publish"), [...shared, "version-name"]);
  assert.deepEqual(inputsOfActionYml("preview"), [...shared, "changed-only"]);
});
