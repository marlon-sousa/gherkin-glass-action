// Tests docs/BEHAVIOUR.md, rules 27 and 29: the comment that gives a pull request its preview's address.

import assert from "node:assert/strict";
import { test } from "node:test";
import { builtFromOf, previewCommentAmong, previewCommentOf, REMOVED_PREVIEW_COMMENT } from "../../src/policies/preview_comment.ts";

test("the comment starts with the marker, then says where the preview is, or that it was removed", () => {
  assert.equal(
    previewCommentOf("https://owner.github.io/repo/previews/pr-12/", undefined),
    "<!-- gherkin-glass-action preview -->\nThe preview of this pull request's feature files is at https://owner.github.io/repo/previews/pr-12/.",
  );
  assert.equal(
    REMOVED_PREVIEW_COMMENT,
    "<!-- gherkin-glass-action preview -->\nThe preview of this pull request was removed when it closed.",
  );
});

test("the action's comment is found by the marker at its start, and no other", () => {
  const comments = [
    { id: 1, body: "Looks good. <!-- gherkin-glass-action preview -->" },
    { id: 2, body: REMOVED_PREVIEW_COMMENT },
    { id: 3, body: previewCommentOf("x", undefined) },
  ];
  assert.equal(previewCommentAmong(comments)?.id, 2);
  assert.equal(previewCommentAmong([{ id: 1, body: "nothing" }]), undefined);
});

test("the comment names the commit the preview was built from, in a line of its own that is not shown", () => {
  const body = previewCommentOf("https://owner.github.io/repo/previews/pr-12/", "0a1b2c");
  assert.equal(
    body,
    "<!-- gherkin-glass-action preview -->\n<!-- built from 0a1b2c -->\nThe preview of this pull request's feature files is at https://owner.github.io/repo/previews/pr-12/.",
  );
  assert.equal(builtFromOf(body), "0a1b2c");
  assert.equal(builtFromOf(REMOVED_PREVIEW_COMMENT), undefined);
});
