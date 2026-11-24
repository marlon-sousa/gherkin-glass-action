// Policy: the annotation a problem of ghg build's report becomes, as docs/BEHAVIOUR.md, rule 10, says.

import path from "node:path";
import type { BuildProblem } from "./build_report.ts";
import type { ReportPaths } from "./report_paths.ts";

/** An error annotation on a file and a line. */
export interface Annotation {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/**
 * The annotation of a problem, if it names a line. Its path is the one the report prints, as
 * gherkin-glass's rules 16, 26 and 187 to 190 write it: from the workspace for the
 * configuration file and the front page, from the input folder for a file of it.
 */
export function annotationOf(problem: BuildProblem, paths: ReportPaths): Annotation | undefined {
  if (problem.line === undefined) return undefined;
  const fromWorkspace = paths.workspaceFiles.includes(path.normalize(problem.path));
  const file = fromWorkspace ? problem.path : path.join(paths.inputFolder, problem.path);
  return { file: file.split(path.sep).join("/"), line: problem.line, message: problem.message };
}
