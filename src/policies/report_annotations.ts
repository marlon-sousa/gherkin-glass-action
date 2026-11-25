// Policy: the annotation a problem of ghg build's report becomes.

import path from "node:path";
import type { BuildProblem } from "./build_report.ts";
import type { ReportPaths } from "./report_paths.ts";

export interface Annotation {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/** Undefined when the problem names no line; the report names the workspace's files from the workspace, and the input folder's from that folder. */
export function annotationOf(problem: BuildProblem, paths: ReportPaths): Annotation | undefined {
  if (problem.line === undefined) return undefined;
  const fromWorkspace = paths.workspaceFiles.includes(path.normalize(problem.path));
  const file = fromWorkspace ? problem.path : path.join(paths.inputFolder, problem.path);
  return { file: file.split(path.sep).join("/"), line: problem.line, message: problem.message };
}
