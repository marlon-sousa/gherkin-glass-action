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
  /** Puts a folder on the PATH of the job's later steps. */
  addToPath(folder: string): void;
  /** Gives the job's later steps an output of the step. */
  setOutput(name: string, value: string): void;
  /** Writes a line to the step's log. */
  log(line: string): void;
  /** Writes a line to the step's log as a notice, which the workflow's summary shows. */
  notice(line: string): void;
  /** The event that runs the workflow. */
  workflowEvent(): WorkflowEvent;
  /** Shows an error annotation on a file and a line. */
  annotate(annotation: Annotation): void;
  /** Fails the step with the sentence that says why. */
  fail(message: string): void;
  /** Registers the problem matcher of ghg build's report for the job's later steps. */
  addProblemMatcher(): Promise<void>;
}
