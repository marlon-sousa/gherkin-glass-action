// Adapter: the runner, through @actions/core and the runner's environment.

import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as core from "@actions/core";
import { PROBLEM_MATCHER } from "../policies/problem_matcher.ts";
import type { Annotation } from "../policies/report_annotations.ts";
import type { WorkflowEvent } from "../policies/workflow_event.ts";
import type { Runner } from "../ports/runner.ts";

export class ActionsRunner implements Runner {
  readonly system = process.env["RUNNER_OS"] ?? "";
  readonly processor = process.env["RUNNER_ARCH"] ?? "";
  readonly workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
  readonly onGitHubCom = (process.env["GITHUB_SERVER_URL"] ?? "https://github.com") === "https://github.com";

  input(name: string): string {
    return core.getInput(name);
  }

  addToPath(folder: string): void {
    core.addPath(folder);
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }

  log(line: string): void {
    core.info(line);
  }

  notice(line: string): void {
    core.notice(line);
  }

  workflowEvent(): WorkflowEvent {
    const payloadFile = process.env["GITHUB_EVENT_PATH"];
    return {
      name: process.env["GITHUB_EVENT_NAME"] ?? "",
      refName: process.env["GITHUB_REF_NAME"] ?? "",
      payload: payloadFile === undefined ? undefined : JSON.parse(readFileSync(payloadFile, "utf8")),
    };
  }

  annotate(annotation: Annotation): void {
    core.error(annotation.message, { file: annotation.file, startLine: annotation.line });
  }

  // The runner reads a matcher from the file an add-matcher command names, as actions/setup-node v7.1.0 registers its own.
  async addProblemMatcher(): Promise<void> {
    const file = path.join(process.env["RUNNER_TEMP"] ?? os.tmpdir(), "ghg-problem-matcher.json");
    await writeFile(file, JSON.stringify(PROBLEM_MATCHER));
    core.info(`::add-matcher::${file}`);
  }

  fail(message: string): void {
    core.setFailed(message);
  }
}
