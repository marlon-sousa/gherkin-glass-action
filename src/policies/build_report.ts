// Policy: how ghg build ended, from the JSON object --message-format=json prints, as docs/BEHAVIOUR.md, rules 7, 10 and 18, say.

import { fieldOf } from "./json_field.ts";

/** A problem that stopped the build, as gherkin-glass's rule 231 gives it under errors. */
export interface BuildProblem {
  readonly path: string;
  readonly line: number | undefined;
  readonly message: string;
}

/** How the build ended: the site written into output, nothing to build, or stopped by its problems. */
export type BuildReport =
  | { readonly outcome: "built"; readonly output: string }
  | { readonly outcome: "nothing-to-build" }
  | { readonly outcome: "stopped"; readonly errors: readonly BuildProblem[] };

/** The sentence the action stops with when ghg build gives no report it can read. */
export const NO_REPORT_PROBLEM = "ghg build gave no report of how it ended.";

const NO_REPORT = { problem: NO_REPORT_PROBLEM };

/**
 * The report in ghg build's standard output, which holds one JSON object on its last line
 * (gherkin-glass's rule 231), or the sentence the action stops with when it holds none.
 */
export function buildReportOf(standardOutput: string): BuildReport | { readonly problem: string } {
  const lastLine = standardOutput.trimEnd().split(/\r?\n/).at(-1) ?? "";
  let report: unknown;
  try {
    report = JSON.parse(lastLine);
  } catch {
    return NO_REPORT;
  }
  const [outcome, output, errors] = ["outcome", "output", "errors"].map((name) => fieldOf(report, name));
  if (outcome === "built" && typeof output === "string") return { outcome, output };
  if (outcome === "nothing-to-build") return { outcome };
  if (outcome === "stopped" && Array.isArray(errors)) return { outcome, errors: errors.flatMap(problemOf) };
  return NO_REPORT;
}

function problemOf(error: unknown): BuildProblem[] {
  const [path, line, message] = ["path", "line", "message"].map((name) => fieldOf(error, name));
  if (typeof path !== "string" || typeof message !== "string") return [];
  return [{ path, line: typeof line === "number" ? line : undefined, message }];
}
