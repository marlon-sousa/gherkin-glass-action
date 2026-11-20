// Tests docs/BEHAVIOUR.md, rule 10: the problem matcher for the job's later steps.

import assert from "node:assert/strict";
import { test } from "node:test";
import { PROBLEM_MATCHER } from "../../src/policies/problem_matcher.ts";

const [matcher] = PROBLEM_MATCHER.problemMatcher;
const [pattern] = matcher?.pattern ?? [];

function matched(line: string) {
  const match = new RegExp(pattern?.regexp ?? "").exec(line);
  return match && pattern ? [match[pattern.file], match[pattern.line], match[pattern.message]] : undefined;
}

test("the matcher is ghg's, and its problems are errors", () => {
  assert.equal(matcher?.owner, "ghg");
  assert.equal(matcher?.severity, "error");
});

test("a line naming a file and a line gives its path as ghg printed it", () => {
  assert.deepEqual(matched("shop/basket.feature:12: Syntax error."), ["shop/basket.feature", "12", "Syntax error."]);
  assert.deepEqual(matched("C:\\specs\\a.feature:3: expected: Given"), ["C:\\specs\\a.feature", "3", "expected: Given"]);
});

test("any other line is not matched", () => {
  assert.equal(matched("shop/basket.feature: cannot be read: Permission denied"), undefined);
  assert.equal(matched("The site has no title."), undefined);
});
