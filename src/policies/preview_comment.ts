// Policy: the comment that gives a pull request its preview's address, as docs/BEHAVIOUR.md, rules 27 and 29, say.

/** The line that starts the action's comment, by which it finds it again. */
export const PREVIEW_COMMENT_MARKER = "<!-- gherkin-glass-action preview -->";

/** The comment once the preview built from that commit is published at that address; without a commit, it names none. */
export function previewCommentOf(address: string, builtFrom: string | undefined): string {
  const commitLine = builtFrom === undefined ? "" : `<!-- built from ${builtFrom} -->\n`;
  return `${PREVIEW_COMMENT_MARKER}\n${commitLine}The preview of this pull request's feature files is at ${address}.`;
}

/** The commit the preview a comment gives was built from, undefined when it names none. */
export function builtFromOf(body: string): string | undefined {
  return /^<!-- built from ([0-9a-f]+) -->$/m.exec(body)?.[1];
}

/** The comment once the preview of a closed pull request is removed. */
export const REMOVED_PREVIEW_COMMENT = `${PREVIEW_COMMENT_MARKER}\nThe preview of this pull request was removed when it closed.`;

/** The action's comment among a pull request's, the first that starts with the marker. */
export function previewCommentAmong<T extends { readonly body: string }>(comments: readonly T[]): T | undefined {
  return comments.find((comment) => comment.body.startsWith(PREVIEW_COMMENT_MARKER));
}
