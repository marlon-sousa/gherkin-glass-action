// Tests docs/BEHAVIOUR.md, rule 23: publish adds a version of the site to the branch Pages serves.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { PushOutcome } from "../../src/ports/site_branch.ts";
import { publishVersion } from "../../src/services/publishing_version.ts";
import { publishingPorts, siteRequest } from "../support/publishing_fakes.ts";

function publishing(outcomes: PushOutcome[] = ["pushed"], folder = "features") {
  const used = publishingPorts(outcomes);
  const request = { ...siteRequest({ folder }), versionName: "v1.2.0" };
  return { used, run: () => publishVersion("ghg", request, used) };
}

test("a versioned build goes into folder of the branch, and the log and the output say where it is published", async () => {
  const { used, run } = publishing();
  await run();
  assert.deepEqual(used.process.runs, [
    ["ghg", "build", "--title=T", `--output=${path.join("checkout-1", "features")}`, "--version-name=v1.2.0"],
  ]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the site's version v1.2.0"]);
  assert.deepEqual(used.runner.logged, ["The site is published on gh-pages, at https://owner.github.io/repo/features/v1.2.0/."]);
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/features/v1.2.0/");
  assert.deepEqual(used.repository.written, []);
});

test("a folder left empty publishes into the branch's root", async () => {
  const { used, run } = publishing(["pushed"], "");
  await run();
  assert.equal(used.process.runs[0]?.[3], "--output=checkout-1");
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/v1.2.0/");
});

test("a version already published gives its address all the same", async () => {
  const { used, run } = publishing(["unchanged"]);
  await run();
  assert.deepEqual(used.runner.logged, ["The site on gh-pages is already up to date."]);
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/features/v1.2.0/");
});
