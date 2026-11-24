// Tests docs/BEHAVIOUR.md, rule 19: what publish and preview keep in the folder the site goes into.

import assert from "node:assert/strict";
import { test } from "node:test";
import { keptInOutputArguments } from "../../src/policies/kept_in_output.ts";

const PAGES_FILES = ["--keep-in-output=/.nojekyll", "--keep-in-output=/CNAME"];

test("the files Pages reads are always kept, first", () => {
  assert.deepEqual(keptInOutputArguments("", undefined), PAGES_FILES);
});

test("the input's patterns follow them, and the configuration file's are then not passed", () => {
  assert.deepEqual(keptInOutputArguments("README.md\n\n!notes/", 'keep_in_output = ["robots.txt"]'), [
    ...PAGES_FILES,
    "--keep-in-output=README.md",
    "--keep-in-output=!notes/",
  ]);
});

test("without the input, the configuration file's patterns follow them, since ghg would not read the key", () => {
  assert.deepEqual(keptInOutputArguments("", 'keep_in_output = ["robots.txt", "", "google*.html"]'), [
    ...PAGES_FILES,
    "--keep-in-output=robots.txt",
    "--keep-in-output=google*.html",
  ]);
});

test("a key that is not a list of text, or a file that is not TOML, adds nothing, and ghg reports it", () => {
  for (const configText of ['keep_in_output = "robots.txt"', "keep_in_output = [1]", "keep_in_output = [", 'title = "T"']) {
    assert.deepEqual(keptInOutputArguments("", configText), PAGES_FILES, configText);
  }
});
