// Port: the runner the action runs on, its inputs, and what the job's later steps see.

import type { Annotation } from "../policies/report_annotations.ts";
import type { WorkflowEvent } from "../policies/workflow_event.ts";

export interface Runner {
  /** The input of that name, trimmed, empty when it is not given. */
  input(name: string): string;
  /** The runner's system and processor, in its own words, RUNNER_OS and RUNNER_ARCH. */
  readonly system: string;
  readonly processor: string;
  /** The workspace folder, GITHUB_WORKSPACE, where ghg build runs. */
  readonly workspace: string;
  /** Whether the workflow runs on github.com, whose token the workflow's own is. */
  readonly onGitHubCom: boolean;
  addToPath(folder: string): void;
  setOutput(name: string, value: string): void;
  log(line: string): void;
  /** Writes a line to the step's log as a notice, which the workflow's summary shows. */
  notice(line: string): void;
  workflowEvent(): WorkflowEvent;
  annotate(annotation: Annotation): void;
  fail(message: string): void;
  addProblemMatcher(): Promise<void>;
}
