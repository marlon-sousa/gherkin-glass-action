// Tests docs/BEHAVIOUR.md, rules 23 to 26 and 29: what the workflow's event asks the publish and preview actions to do.

import assert from "node:assert/strict";
import { test } from "node:test";
import { previewEventOf, versionNameOf, type WorkflowEvent } from "../../src/policies/workflow_event.ts";

function pullRequest(action: string, headRepository: string | null = "owner/repo", head: object = {}): WorkflowEvent {
  return {
    name: "pull_request",
    refName: "12/merge",
    payload: {
      action,
      number: 12,
      pull_request: { head: { repo: headRepository === null ? null : { full_name: headRepository }, ...head } },
      repository: { full_name: "owner/repo" },
    },
  };
}

test("a version is named by the tag or branch that ran, with every / made a -", () => {
  assert.equal(versionNameOf("", "v1.2.0"), "v1.2.0");
  assert.equal(versionNameOf("", "feature/login"), "feature-login");
});

test("version-name, when given, names the version instead", () => {
  assert.equal(versionNameOf("latest", "main"), "latest");
});

test("a pull request asks for its preview, and for its removal once closed, merged or not", () => {
  for (const action of ["opened", "reopened", "synchronize"]) {
    assert.deepEqual(previewEventOf(pullRequest(action)), { kind: "open", pullRequest: 12, headCommit: undefined });
  }
  assert.deepEqual(previewEventOf(pullRequest("closed")), { kind: "closed", pullRequest: 12 });
});

test("a pull request's event gives the commit its head points to", () => {
  assert.deepEqual(previewEventOf(pullRequest("synchronize", "owner/repo", { sha: "bbb" })), {
    kind: "open",
    pullRequest: 12,
    headCommit: "bbb",
  });
});

test("a pull request from a fork asks for nothing", () => {
  assert.deepEqual(previewEventOf(pullRequest("opened", "someone/repo")), { kind: "fork" });
  assert.deepEqual(previewEventOf(pullRequest("opened", null)), { kind: "fork" });
});

test("any other event stops preview", () => {
  assert.deepEqual(previewEventOf({ name: "push", refName: "main", payload: {} }), {
    problem: "preview acts on a pull request, not on push.",
  });
});
