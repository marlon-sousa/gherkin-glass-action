// Tests rules 7, 10 and 18: how ghg build ended, from the JSON object it prints.

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReportOf } from "../../src/policies/build_report.ts";

const NO_REPORT = { problem: "ghg build gave no report of how it ended." };

test("a site built gives the folder it was written into", () => {
  const printed =
    '{"outcome":"built","output":"docs/site","version":null,"features":1,"scenarios":2,"notes":[],"errors":[]}\n';
  assert.deepEqual(buildReportOf(printed), { outcome: "built", output: "docs/site" });
});

test("nothing to build is told apart", () => {
  const printed = '{"outcome":"nothing-to-build","output":null,"version":null,"features":null,"scenarios":null,"notes":[],"errors":[]}';
  assert.deepEqual(buildReportOf(printed), { outcome: "nothing-to-build" });
});

test("a build stopped gives its problems, a line or none", () => {
  const errors = '[{"path":"a.feature","line":3,"message":"Syntax error."},{"path":"b.feature","line":null,"message":"cannot be read: denied"}]';
  assert.deepEqual(buildReportOf(`{"outcome":"stopped","output":null,"errors":${errors}}\r\n`), {
    outcome: "stopped",
    errors: [
      { path: "a.feature", line: 3, message: "Syntax error." },
      { path: "b.feature", line: undefined, message: "cannot be read: denied" },
    ],
  });
});

test("the object is read from the last line, whatever came before it", () => {
  assert.deepEqual(buildReportOf('something else\n{"outcome":"built","output":"site"}\n'), { outcome: "built", output: "site" });
});

test("anything else is no report", () => {
  for (const printed of ["", "\n", "not json", "[]", "null", '{"outcome":"built"}', '{"outcome":"stopped"}', '{"outcome":"done"}']) {
    assert.deepEqual(buildReportOf(printed), NO_REPORT, printed);
  }
});
