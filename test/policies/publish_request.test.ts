// Tests docs/BEHAVIOUR.md, rule 18: the inputs that ask for the site to be published.

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishInputsOf } from "../../src/policies/publish_request.ts";

const DEFAULTS = { publish: "true", "publish-branch": "gh-pages", "publish-folder": "" };

function inputsOf(inputs: Record<string, string>) {
  return publishInputsOf((name) => inputs[name] ?? "");
}

test("publish is false by default, and asks for nothing then", () => {
  assert.equal(inputsOf({}), undefined);
  assert.equal(inputsOf({ publish: "false", output: "public" }), undefined);
});

test("publish true names the branch and the folder, without the / that may end it", () => {
  assert.deepEqual(inputsOf(DEFAULTS), { branch: "gh-pages", folder: "", changedOnly: false });
  assert.deepEqual(inputsOf({ ...DEFAULTS, "publish-branch": "site", "publish-folder": "docs/features/" }), {
    branch: "site",
    folder: "docs/features",
    changedOnly: false,
  });
});

test("each input that cannot be used stops the action", () => {
  assert.deepEqual(inputsOf({ ...DEFAULTS, publish: "yes" }), { problem: "publish must be true or false." });
  assert.deepEqual(inputsOf({ ...DEFAULTS, "publish-branch": "" }), { problem: "publish-branch must name a branch." });
  for (const folder of ["/features", "C:/site", "a//b", "./features", "a/../b", "..", "a\\b"]) {
    assert.deepEqual(
      inputsOf({ ...DEFAULTS, "publish-folder": folder }),
      { problem: "publish-folder must be a folder of publish-branch, such as features." },
      folder,
    );
  }
});

test("publish decides where the site goes and which are previews", () => {
  assert.deepEqual(inputsOf({ ...DEFAULTS, output: "public" }), {
    problem: "publish writes the site into publish-branch, so output must be empty.",
  });
  assert.deepEqual(inputsOf({ ...DEFAULTS, preview: "true" }), {
    problem: "publish chooses which sites are previews, so preview must be empty.",
  });
  assert.deepEqual(inputsOf({ ...DEFAULTS, preview: "false" }), { branch: "gh-pages", folder: "", changedOnly: false });
});

test("changed-only narrows a preview, and leaves only to the action", () => {
  assert.deepEqual(inputsOf({ ...DEFAULTS, "changed-only": "true" }), { branch: "gh-pages", folder: "", changedOnly: true });
  assert.deepEqual(inputsOf({ ...DEFAULTS, "changed-only": "yes" }), { problem: "changed-only must be true or false." });
  assert.deepEqual(inputsOf({ ...DEFAULTS, "changed-only": "true", only: "list.txt" }), {
    problem: "changed-only gives ghg the files the pull request changes, so only must be empty.",
  });
  assert.deepEqual(inputsOf({ ...DEFAULTS, only: "list.txt" }), { branch: "gh-pages", folder: "", changedOnly: false });
});
