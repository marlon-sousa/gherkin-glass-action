// Tests docs/BEHAVIOUR.md, rule 10: the annotation of each line of ghg build's report.

import assert from "node:assert/strict";
import { test } from "node:test";
import { annotationOf } from "../../src/policies/report_annotations.ts";

const PATHS = { inputFolder: "features", workspaceFiles: ["ghg.toml", "docs/front.md"] };

test("a feature file's problem is annotated on its file in the input folder", () => {
  assert.deepEqual(annotationOf("shop/basket.feature:12: Syntax error.", PATHS), {
    file: "features/shop/basket.feature",
    line: 12,
    message: "Syntax error.",
  });
});

test("the message keeps its colons", () => {
  assert.deepEqual(annotationOf("a.feature:3: expected: Given, When: 2\r", PATHS), {
    file: "features/a.feature",
    line: 3,
    message: "expected: Given, When: 2",
  });
});

test("a problem of the configuration file is annotated on the file as given", () => {
  assert.deepEqual(annotationOf("ghg.toml:4: ghg has no setting named colour.", PATHS), {
    file: "ghg.toml",
    line: 4,
    message: "ghg has no setting named colour.",
  });
});

test("a problem of the front page is annotated on the file as ghg names it", () => {
  assert.deepEqual(annotationOf("docs/front.md:3: holds a second level-one heading, but a front page has one only.", PATHS), {
    file: "docs/front.md",
    line: 3,
    message: "holds a second level-one heading, but a front page has one only.",
  });
});

test("a line without a line number, and any other line, is not annotated", () => {
  assert.equal(annotationOf("shop/basket.feature: cannot be read: Permission denied", PATHS), undefined);
  assert.equal(annotationOf("The site has no title, so its home page is called Feature files.", PATHS), undefined);
  assert.equal(annotationOf("", PATHS), undefined);
});
