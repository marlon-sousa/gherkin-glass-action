// Service: runs ghg build and annotates its report.

import { ActionStop, orStop } from "../action_stop.ts";
import { buildReportOf, NO_REPORT_PROBLEM, type BuildReport } from "../policies/build_report.ts";
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

export type BuildOutcome = Exclude<BuildReport, { readonly outcome: "stopped" }>;

export async function buildSite(ghg: string, request: BuildRequest, ports: BuildingPorts): Promise<BuildOutcome> {
  const run = await ports.process.run(ghg, ["build", ...request.buildArguments, "--message-format=json"]);
  const report = buildReportOf(run.standardOutput);
  if ("outcome" in report && report.outcome === "stopped") {
    const paths = reportPathsOf({ ...request, configText: await ports.files.readText(request.configFile) });
    for (const problem of report.errors) {
      const annotation = annotationOf(problem, paths);
      if (annotation !== undefined) ports.runner.annotate(annotation);
    }
  }
  if (run.status !== 0) throw new ActionStop(`ghg build stopped with status ${run.status}.`);
  const passed = orStop(report);
  if (passed.outcome === "stopped") throw new ActionStop(NO_REPORT_PROBLEM);
  return passed;
}
