// Tests docs/BEHAVIOUR.md, rules 19, 20, 22 and 23: what the workflow's event asks to publish.

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishTargetOf, type WorkflowEvent } from "../../src/policies/workflow_event.ts";

const ROOT = { branch: "gh-pages", folder: "" };
const FEATURES = { branch: "gh-pages", folder: "features" };

function pullRequest(action: string, headRepository: string | null = "owner/repo"): WorkflowEvent {
  return {
    name: "pull_request",
    refName: "12/merge",
    payload: {
      action,
      number: 12,
      pull_request: { head: { repo: headRepository === null ? null : { full_name: headRepository } } },
      repository: { full_name: "owner/repo" },
    },
  };
}

test("a push publishes a version named by the tag or branch, with every / made a -", () => {
  assert.deepEqual(publishTargetOf({ name: "push", refName: "v1.2.0", payload: {} }, FEATURES, ""), {
    kind: "version",
    versionName: "v1.2.0",
    folder: "features",
  });
  assert.deepEqual(publishTargetOf({ name: "push", refName: "feature/login", payload: {} }, ROOT, ""), {
    kind: "version",
    versionName: "feature-login",
    folder: "",
  });
});

test("version-name, when given, names the version instead", () => {
  assert.deepEqual(publishTargetOf({ name: "push", refName: "main", payload: {} }, ROOT, "latest"), {
    kind: "version",
    versionName: "latest",
    folder: "",
  });
});

test("a pull request publishes its preview, and removes it once closed, merged or not", () => {
  for (const action of ["opened", "synchronize", "reopened"]) {
    assert.deepEqual(publishTargetOf(pullRequest(action), FEATURES, "ignored"), {
      kind: "preview",
      pullRequest: 12,
      folder: "features/previews/pr-12",
    });
  }
  assert.deepEqual(publishTargetOf(pullRequest("closed"), ROOT, ""), {
    kind: "removal",
    pullRequest: 12,
    folder: "previews/pr-12",
  });
});

test("a pull request from a fork publishes nothing", () => {
  assert.deepEqual(publishTargetOf(pullRequest("opened", "someone/repo"), ROOT, ""), { kind: "fork" });
  assert.deepEqual(publishTargetOf(pullRequest("opened", null), ROOT, ""), { kind: "fork" });
});

test("any other event stops the action", () => {
  assert.deepEqual(publishTargetOf({ name: "workflow_dispatch", refName: "main", payload: {} }, ROOT, ""), {
    problem: "publish acts on a push or a pull request, not on workflow_dispatch.",
  });
});
