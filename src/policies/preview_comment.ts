// Policy: the comment that gives a pull request its preview's address.

/** The comment's first line, by which the action finds it again. */
export const PREVIEW_COMMENT_MARKER = "<!-- gherkin-glass-action preview -->";

export function previewCommentOf(address: string, builtFrom: string | undefined): string {
  const commitLine = builtFrom === undefined ? "" : `<!-- built from ${builtFrom} -->\n`;
  return `${PREVIEW_COMMENT_MARKER}\n${commitLine}The preview of this pull request's feature files is at ${address}.`;
}

/** Undefined when the comment names no commit. */
export function builtFromOf(body: string): string | undefined {
  return /^<!-- built from ([0-9a-f]+) -->$/m.exec(body)?.[1];
}

export const REMOVED_PREVIEW_COMMENT = `${PREVIEW_COMMENT_MARKER}\nThe preview of this pull request was removed when it closed.`;

export function previewCommentAmong<T extends { readonly body: string }>(comments: readonly T[]): T | undefined {
  return comments.find((comment) => comment.body.startsWith(PREVIEW_COMMENT_MARKER));
}
