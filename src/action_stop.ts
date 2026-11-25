// Error: why the action stops, in the sentence a person reads.

export class ActionStop extends Error {
  override readonly name = "ActionStop";
}

/** The value of a policy's result, or an ActionStop with the problem it gives instead. */
export function orStop<T>(result: T | { readonly problem: string }): T {
  if (typeof result === "object" && result !== null && "problem" in result) throw new ActionStop(result.problem);
  return result;
}
