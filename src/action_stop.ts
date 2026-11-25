// Error: why the action stops, in the sentences a person reads, one for each reason.

export class ActionStop extends Error {
  override readonly name = "ActionStop";
  readonly sentences: readonly [string, ...string[]];

  constructor(...sentences: [string, ...string[]]) {
    super(sentences.join(" "));
    this.sentences = sentences;
  }
}

/** The value of a policy's result, or an ActionStop with the problem it gives instead. */
export function orStop<T>(result: T | { readonly problem: string }): T {
  if (typeof result === "object" && result !== null && "problem" in result) throw new ActionStop(result.problem);
  return result;
}

/** The sentences a failed step shows for an error the action caught, one error each. */
export function stopSentencesOf(error: unknown): readonly string[] {
  return error instanceof ActionStop ? error.sentences : [`The action failed unexpectedly: ${String(error)}`];
}
