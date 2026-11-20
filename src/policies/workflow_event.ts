// Policy: what the event that runs the workflow asks the publish and preview actions to do, as docs/BEHAVIOUR.md, rules 23 to 26 and 29, say.

/** The event that runs the workflow, as the runner gives it. */
export interface WorkflowEvent {
  /** GITHUB_EVENT_NAME, such as push or pull_request. */
  readonly name: string;
  /** GITHUB_REF_NAME, the tag or branch that ran. */
  readonly refName: string;
  /** The event's payload, as the file GITHUB_EVENT_PATH holds it. */
  readonly payload: unknown;
}

/** What a pull request's event asks of its preview. */
export type PreviewEvent =
  | { readonly kind: "fork" }
  | { readonly kind: "closed"; readonly pullRequest: number }
  /** headCommit is the commit the pull request's head branch points to, when the payload gives it. */
  | { readonly kind: "open"; readonly pullRequest: number; readonly headCommit: string | undefined };

/** The name of the version publish adds: version-name, else the tag or branch that ran, with every / made a -. */
export function versionNameOf(versionNameInput: string, refName: string): string {
  // A version name is one folder name (gherkin-glass's rule 121), and a branch's may hold a /.
  return versionNameInput !== "" ? versionNameInput : refName.replaceAll("/", "-");
}

/**
 * What the event asks of the pull request's preview, or the sentence the action stops with on
 * an event that is not a pull request's. A pull request's payload without a number is not one
 * GitHub sends, and throws.
 */
export function previewEventOf(event: WorkflowEvent): PreviewEvent | { readonly problem: string } {
  if (event.name !== "pull_request") return { problem: `preview acts on a pull request, not on ${event.name}.` };
  const { payload } = event;
  const pullRequest = field(payload, "number");
  // GitHub gives every pull_request event its number, so a payload without one is not GitHub's.
  if (typeof pullRequest !== "number") throw new Error("the pull request's event has no number");
  // A head whose repository was deleted has none, which is a fork too.
  const headRepository = field(field(field(field(payload, "pull_request"), "head"), "repo"), "full_name");
  if (typeof headRepository !== "string" || headRepository !== field(field(payload, "repository"), "full_name")) {
    return { kind: "fork" };
  }
  const action = field(payload, "action");
  if (action === "closed") return { kind: "closed", pullRequest };
  const headCommit = field(field(field(payload, "pull_request"), "head"), "sha");
  return { kind: "open", pullRequest, headCommit: typeof headCommit === "string" ? headCommit : undefined };
}

// A field of GitHub's pull_request payload: action, number, pull_request.head.repo,
// pull_request.head.sha and repository.
function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && name in value ? Reflect.get(value, name) : undefined;
}
