// Service: runs ghg build and annotates its report, as docs/BEHAVIOUR.md, "Building" and "Annotations", say.

import { ActionStop } from "../action_stop.ts";
import { annotationOf } from "../policies/report_annotations.ts";
import { reportPathsOf } from "../policies/report_paths.ts";
import type { Files } from "../ports/files.ts";
import type { GhgProcess } from "../ports/ghg_process.ts";
import type { Runner } from "../ports/runner.ts";
import type { BuildRequest } from "./reading_inputs.ts";

export interface BuildingPorts {
  readonly runner: Runner;
  readonly process: GhgProcess;
  readonly files: Files;
}

/** Runs ghg build in the workspace, annotating each line of its report that names a file and a line. */
export async function buildSite(ghg: string, request: BuildRequest, ports: BuildingPorts): Promise<void> {
  const paths = reportPathsOf({
    input: request.input,
    frontPage: request.frontPage,
    configFile: request.configFile,
    configText: await ports.files.readText(request.configFile),
  });
  const status = await ports.process.run(ghg, ["build", ...request.buildArguments], (line) => {
    const annotation = annotationOf(line, paths);
    if (annotation !== undefined) ports.runner.annotate(annotation);
  });
  if (status !== 0) throw new ActionStop(`ghg build stopped with status ${status}.`);
}
