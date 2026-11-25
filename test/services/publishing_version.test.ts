// Tests rule 23: publish adds a version of the site to the branch Pages serves.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { PushOutcome } from "../../src/ports/site_branch.ts";
import { publishVersion } from "../../src/services/publishing_version.ts";
import { FakeGhgProcess, ghgReport } from "../support/fakes.ts";
import { publishingPorts, siteRequest } from "../support/publishing_fakes.ts";

const KEPT = ["--keep-in-output=/.nojekyll", "--keep-in-output=/CNAME"];

function publishing(outcomes: PushOutcome[] = ["pushed"], folder = "features", process = new FakeGhgProcess()) {
  const used = publishingPorts(outcomes, undefined, undefined, process);
  const request = { ...siteRequest({ folder }), versionName: "v1.2.0" };
  return { used, run: () => publishVersion("ghg", request, used) };
}

test("a versioned build goes into folder of the branch, and the log and the output say where it is published", async () => {
  const { used, run } = publishing();
  await run();
  assert.deepEqual(used.process.runs, [
    [
      "ghg",
      "build",
      ...KEPT,
      `--output=${path.join("checkout-1", "features")}`,
      "--title=T",
      "--version-name=v1.2.0",
      "--message-format=json",
    ],
  ]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push Publish the site's version v1.2.0"]);
  assert.deepEqual(used.runner.logged, ["The site is published on gh-pages, at https://owner.github.io/repo/features/v1.2.0/."]);
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/features/v1.2.0/");
  assert.deepEqual(used.repository.written, []);
});

test("a folder left empty publishes into the branch's root", async () => {
  const { used, run } = publishing(["pushed"], "");
  await run();
  assert.equal(used.process.runs[0]?.[4], "--output=checkout-1");
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/v1.2.0/");
});

test("an empty input title is left out, so that the configuration file's applies", async () => {
  const used = publishingPorts(["pushed"]);
  await publishVersion("ghg", { ...siteRequest({ title: "" }), versionName: "v1.2.0" }, used);
  assert.ok(!used.process.runs[0]?.some((argument) => argument.startsWith("--title")));
});

test("a version already published gives its address all the same", async () => {
  const { used, run } = publishing(["unchanged"]);
  await run();
  assert.deepEqual(used.runner.logged, ["The site on gh-pages is already up to date."]);
  assert.equal(used.runner.outputs.get("address"), "https://owner.github.io/repo/features/v1.2.0/");
});

test("without the input keep-in-output, the configuration file's patterns follow the files Pages reads", async () => {
  const { used, run } = publishing();
  used.files.texts.set("ghg.toml", 'keep_in_output = ["README.md"]');
  await run();
  assert.deepEqual(used.process.runs[0]?.slice(2, 5), [...KEPT, "--keep-in-output=README.md"]);
});

test("nothing to build publishes nothing, and says so", async () => {
  const { used, run } = publishing(["pushed"], "features", new FakeGhgProcess(ghgReport({ outcome: "nothing-to-build", output: null })));
  await run();
  assert.deepEqual(used.siteBranch.steps, ["check out"]);
  assert.deepEqual(used.runner.logged, ["ghg read no feature file, so nothing is published."]);
  assert.equal(used.runner.outputs.get("address"), "");
});
