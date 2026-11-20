// Policy: the comment that gives a pull request its preview's address, as docs/BEHAVIOUR.md, rule 25, says.

/** The line that starts the action's comment, by which it finds it again. */
export const PREVIEW_COMMENT_MARKER = "<!-- gherkin-glass-action preview -->";

/** The comment once the preview is published at that address. */
export function previewCommentOf(address: string): string {
  return `${PREVIEW_COMMENT_MARKER}\nThe preview of this pull request's feature files is at ${address}.`;
}

/** The comment once the preview of a closed pull request is removed. */
export const REMOVED_PREVIEW_COMMENT = `${PREVIEW_COMMENT_MARKER}\nThe preview of this pull request was removed when it closed.`;

/** The action's comment among a pull request's, the first that starts with the marker. */
export function previewCommentAmong<T extends { readonly body: string }>(comments: readonly T[]): T | undefined {
  return comments.find((comment) => comment.body.startsWith(PREVIEW_COMMENT_MARKER));
}
