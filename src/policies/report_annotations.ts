// Policy: the annotation a line of ghg build's report becomes, as docs/BEHAVIOUR.md, rule 10, says.

import path from "node:path";
import type { ReportPaths } from "./report_paths.ts";

/** An error annotation on a file and a line. */
export interface Annotation {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

// <path>:<line>: <message>, as gherkin-glass's rules 16, 26 and 187 to 190 write it. The
// path may hold a colon, as a Windows path does, so the line is the first number between colons.
const FILE_AND_LINE = /^(.+?):(\d+): (.+)$/;

/** The annotation of a line of the report, if the line names a file and a line. */
export function annotationOf(reportLine: string, paths: ReportPaths): Annotation | undefined {
  const match = FILE_AND_LINE.exec(reportLine.trimEnd());
  if (!match) return undefined;
  const [, reported = "", line = "", message = ""] = match;
  const fromWorkspace = paths.workspaceFiles.includes(path.normalize(reported));
  const file = fromWorkspace ? reported : path.join(paths.inputFolder, reported);
  return { file: file.split(path.sep).join("/"), line: Number(line), message };
}
