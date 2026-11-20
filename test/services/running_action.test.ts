// Tests docs/BEHAVIOUR.md, "The action" and rules 3, 10 and 18: the root action from its inputs to its end.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import { runAction } from "../../src/services/running_action.ts";
import { actionPorts as ports } from "../support/action_ports.ts";
import { FakeGhgProcess, FakeRunner } from "../support/fakes.ts";

test("without build, ghg is installed and the problem matcher registered", async () => {
  const runner = new FakeRunner({ token: "a-token" });
  const used = ports(runner);
  await runAction(1, used);
  assert.deepEqual(used.tokens, ["a-token"]);
  assert.deepEqual(runner.path, ["cache/1.2.0"]);
  assert.deepEqual(used.process.runs, []);
  assert.deepEqual(runner.events, ["matcher"]);
});

test("the problem matcher is registered after the build, failed or not", async () => {
  const runner = new FakeRunner({ build: "true" });
  const used = ports(runner, new FakeGhgProcess(["a.feature:1: Syntax error."], 1));
  await runAction(1, used);
  assert.deepEqual(used.process.runs, [[path.join("cache/1.2.0", "ghg"), "build"]]);
  assert.deepEqual(runner.annotations, [{ file: "features/a.feature", line: 1, message: "Syntax error." }]);
  assert.deepEqual(runner.events, ["matcher", "fail"]);
  assert.deepEqual(runner.failures, ["ghg build stopped with status 1."]);
});

test("an input that cannot be used stops the action before anything is listed or downloaded", async () => {
  const runner = new FakeRunner({ build: "yes" });
  const used = ports(runner);
  await runAction(1, used);
  assert.deepEqual(used.tokens, []);
  assert.deepEqual(runner.failures, ["build must be true or false."]);
  assert.deepEqual(runner.events, ["fail"]);
});

test("an error the action does not foresee says so", async () => {
  const runner = new FakeRunner();
  const broken: GhgReleases = {
    listReleases: () => Promise.reject(new Error("the network is gone")),
    downloadFile: () => Promise.resolve(undefined),
  };
  await runAction(1, ports(runner, new FakeGhgProcess(), broken));
  assert.deepEqual(runner.failures, ["The action failed unexpectedly: Error: the network is gone"]);
});

test("the outputs give the version installed, and the folder the site was written into", async () => {
  const built = new FakeRunner({ build: "true", config: "docs/ghg.toml" });
  const used = ports(built);
  used.files.texts.set("docs/ghg.toml", 'output = "public/site"');
  await runAction(1, used);
  assert.deepEqual(Object.fromEntries(built.outputs), { "ghg-version": "1.2.0", site: "docs/public/site" });
  const installed = new FakeRunner();
  await runAction(1, ports(installed));
  assert.deepEqual(Object.fromEntries(installed.outputs), { "ghg-version": "1.2.0", site: "" });
});
