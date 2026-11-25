// Tests rule 10: the annotation of each problem of ghg build's report.

import assert from "node:assert/strict";
import { test } from "node:test";
import { annotationOf } from "../../src/policies/report_annotations.ts";

const PATHS = { inputFolder: "features", workspaceFiles: ["ghg.toml", "docs/front.md"] };

test("a feature file's problem is annotated on its file in the input folder", () => {
  assert.deepEqual(annotationOf({ path: "shop/basket.feature", line: 12, message: "Syntax error." }, PATHS), {
    file: "features/shop/basket.feature",
    line: 12,
    message: "Syntax error.",
  });
});

test("the message is kept whole, colons and all", () => {
  assert.deepEqual(annotationOf({ path: "a.feature", line: 3, message: "expected: Given, When: 2" }, PATHS), {
    file: "features/a.feature",
    line: 3,
    message: "expected: Given, When: 2",
  });
});

test("a problem of the configuration file is annotated on the file as given", () => {
  assert.deepEqual(annotationOf({ path: "ghg.toml", line: 4, message: "ghg has no setting named colour." }, PATHS), {
    file: "ghg.toml",
    line: 4,
    message: "ghg has no setting named colour.",
  });
});

test("a problem of the front page is annotated on the file as ghg names it", () => {
  assert.deepEqual(annotationOf({ path: "docs/front.md", line: 3, message: "holds a second level-one heading, but a front page has one only." }, PATHS), {
    file: "docs/front.md",
    line: 3,
    message: "holds a second level-one heading, but a front page has one only.",
  });
});

test("a problem without a line is not annotated", () => {
  const unreadable = { path: "shop/basket.feature", line: undefined, message: "cannot be read: Permission denied" };
  assert.equal(annotationOf(unreadable, PATHS), undefined);
});
