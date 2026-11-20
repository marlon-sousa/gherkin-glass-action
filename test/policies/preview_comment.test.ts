// Tests docs/BEHAVIOUR.md, rule 25: the comment that gives a pull request its preview's address.

import assert from "node:assert/strict";
import { test } from "node:test";
import { previewCommentAmong, previewCommentOf, REMOVED_PREVIEW_COMMENT } from "../../src/policies/preview_comment.ts";

test("the comment starts with the marker, then says where the preview is, or that it was removed", () => {
  assert.equal(
    previewCommentOf("https://owner.github.io/repo/previews/pr-12/"),
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
    { id: 3, body: previewCommentOf("x") },
  ];
  assert.equal(previewCommentAmong(comments)?.id, 2);
  assert.equal(previewCommentAmong([{ id: 1, body: "nothing" }]), undefined);
});
