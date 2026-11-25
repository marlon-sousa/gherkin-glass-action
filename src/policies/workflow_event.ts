// Policy: what the event that runs the workflow asks the publish and preview actions to do.

import { fieldOf } from "./json_field.ts";

export interface WorkflowEvent {
  readonly name: string;
  readonly refName: string;
  readonly payload: unknown;
}

export type PreviewEvent =
  | { readonly kind: "fork" }
  | { readonly kind: "closed"; readonly pullRequest: number }
  /** headCommit is undefined when the payload gives none. */
  | { readonly kind: "open"; readonly pullRequest: number; readonly headCommit: string | undefined };

export function versionNameOf(versionNameInput: string, refName: string): string {
  // A version name is one folder name.
  return versionNameInput !== "" ? versionNameInput : refName.replaceAll("/", "-");
}

/** Or the sentence the action stops with on an event that is not a pull request's; throws on a payload without a number, which GitHub never sends. */
export function previewEventOf(event: WorkflowEvent): PreviewEvent | { readonly problem: string } {
  if (event.name !== "pull_request") return { problem: `preview acts on a pull request, not on ${event.name}.` };
  const { payload } = event;
  const pullRequest = fieldOf(payload, "number");
  if (typeof pullRequest !== "number") throw new Error("the pull request's event has no number");
  // A head whose repository was deleted has none, which is a fork too.
  const headRepository = fieldOf(fieldOf(fieldOf(fieldOf(payload, "pull_request"), "head"), "repo"), "full_name");
  if (typeof headRepository !== "string" || headRepository !== fieldOf(fieldOf(payload, "repository"), "full_name")) {
    return { kind: "fork" };
  }
  const action = fieldOf(payload, "action");
  if (action === "closed") return { kind: "closed", pullRequest };
  const headCommit = fieldOf(fieldOf(fieldOf(payload, "pull_request"), "head"), "sha");
  return { kind: "open", pullRequest, headCommit: typeof headCommit === "string" ? headCommit : undefined };
}
