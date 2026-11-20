// Policy: what the event that runs the workflow asks the action to publish, as docs/BEHAVIOUR.md, rules 19, 20, 22 and 23, say.

import { posix } from "node:path";
import type { PublishInputs } from "./publish_request.ts";

/** The event that runs the workflow, as the runner gives it. */
export interface WorkflowEvent {
  /** GITHUB_EVENT_NAME, such as push or pull_request. */
  readonly name: string;
  /** GITHUB_REF_NAME, the tag or branch pushed. */
  readonly refName: string;
  /** The event's payload, as the file GITHUB_EVENT_PATH holds it. */
  readonly payload: unknown;
}

/** What to publish on the branch, each with its folder relative to the branch's root. */
export type PublishTarget =
  | { readonly kind: "version"; readonly versionName: string; readonly folder: string }
  | { readonly kind: "preview"; readonly pullRequest: number; readonly folder: string }
  | { readonly kind: "removal"; readonly pullRequest: number; readonly folder: string }
  | { readonly kind: "fork" };

/**
 * What the event asks to publish, or the sentence the action stops with on an event that
 * publishes nothing. A pull request's payload without a number is not one GitHub sends, and
 * throws.
 */
export function publishTargetOf(
  event: WorkflowEvent,
  inputs: Pick<PublishInputs, "folder">,
  versionNameInput: string,
): PublishTarget | { readonly problem: string } {
  if (event.name === "push") {
    // A version name is one folder name (gherkin-glass's rule 121), and a branch's may hold a /.
    const versionName = versionNameInput !== "" ? versionNameInput : event.refName.replaceAll("/", "-");
    return { kind: "version", versionName, folder: inputs.folder };
  }
  if (event.name !== "pull_request") return { problem: `publish acts on a push or a pull request, not on ${event.name}.` };
  const pullRequest = pullRequestOf(event.payload);
  // GitHub gives every pull_request event its number, so a payload without one is not GitHub's.
  if (pullRequest === undefined) throw new Error("the pull request's event has no number");
  if (pullRequest.fromFork) return { kind: "fork" };
  const folder = posix.join(inputs.folder === "" ? "." : inputs.folder, "previews", `pr-${pullRequest.number}`);
  return pullRequest.closed
    ? { kind: "removal", pullRequest: pullRequest.number, folder }
    : { kind: "preview", pullRequest: pullRequest.number, folder };
}

// The pull request's number, whether the event closes it, and whether its head is in another
// repository, as GitHub's pull_request payload says: action, number, pull_request.head.repo,
// repository. A head whose repository was deleted has none, which is a fork too.
function pullRequestOf(payload: unknown): { number: number; closed: boolean; fromFork: boolean } | undefined {
  const number = field(payload, "number");
  if (typeof number !== "number") return undefined;
  const headRepository = field(field(field(field(payload, "pull_request"), "head"), "repo"), "full_name");
  const repository = field(field(payload, "repository"), "full_name");
  return {
    number,
    closed: field(payload, "action") === "closed",
    fromFork: typeof headRepository !== "string" || headRepository !== repository,
  };
}

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && name in value ? Reflect.get(value, name) : undefined;
}
