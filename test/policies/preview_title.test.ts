// Tests rule 30: a preview's title names its pull request.

import assert from "node:assert/strict";
import { test } from "node:test";
import { previewTitleOf } from "../../src/policies/preview_title.ts";

test("the input title wins over the configuration file's", () => {
  assert.equal(previewTitleOf("Our shop", 'title = "Shop"', 12), "Our shop, pull request #12");
});

test("without the input, the configuration file's title is used", () => {
  assert.equal(previewTitleOf("", 'title = "Shop"', 12), "Shop, pull request #12");
});

test("without either, ghg's default title is used", () => {
  assert.equal(previewTitleOf("", undefined, 12), "Feature files, pull request #12");
  assert.equal(previewTitleOf("", 'input = "specs"', 12), "Feature files, pull request #12");
});

test("a title that is not text or is empty, or a file that is not TOML, is not relied on, and ghg reports it", () => {
  for (const configText of ["title = 1", 'title = ""', 'title = "Shop', "title = [\"Shop\"]"]) {
    assert.equal(previewTitleOf("", configText, 12), "Feature files, pull request #12", configText);
  }
});
