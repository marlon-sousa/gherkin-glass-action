// Tests rules 2, 3, 10 and 18: the root action from its inputs to its end.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import OPTIONS from "../../ghg-options.json" with { type: "json" };
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import { runAction } from "../../src/services/running_action.ts";
import { actionPorts as ports } from "../support/action_ports.ts";
import { FakeGhgProcess, FakeRunner, ghgReport } from "../support/fakes.ts";

test("without build, ghg is installed and the problem matcher registered", async () => {
  const runner = new FakeRunner({ token: "a-token" });
  const used = ports(runner);
  await runAction(OPTIONS, used);
  assert.deepEqual(used.tokens, ["a-token"]);
  assert.deepEqual(runner.path, ["cache/1.2.0"]);
  assert.deepEqual(used.process.runs, []);
  assert.deepEqual(runner.events, ["matcher"]);
});

test("the problem matcher is registered after the build, failed or not", async () => {
  const runner = new FakeRunner({ build: "true" });
  const errors = [{ path: "a.feature", line: 1, message: "Syntax error." }];
  const used = ports(runner, new FakeGhgProcess(ghgReport({ outcome: "stopped", output: null, errors }), 1));
  await runAction(OPTIONS, used);
  assert.deepEqual(used.process.runs, [[path.join("cache/1.2.0", "ghg"), "build", "--message-format=json"]]);
  assert.deepEqual(runner.annotations, [{ file: "features/a.feature", line: 1, message: "Syntax error." }]);
  assert.deepEqual(runner.events, ["matcher", "fail"]);
  assert.deepEqual(runner.failures, ["ghg build stopped with status 1."]);
});

test("an input that cannot be used stops the action before anything is listed or downloaded", async () => {
  const runner = new FakeRunner({ build: "yes" });
  const used = ports(runner);
  await runAction(OPTIONS, used);
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
  await runAction(OPTIONS, ports(runner, new FakeGhgProcess(), broken));
  assert.deepEqual(runner.failures, ["The action failed unexpectedly: Error: the network is gone"]);
});

test("the outputs give the version installed, and the folder the site was written into, with / between folders", async () => {
  const built = new FakeRunner({ build: "true", config: "docs/ghg.toml" });
  await runAction(OPTIONS, ports(built, new FakeGhgProcess(ghgReport({ output: path.join("docs", "public", "site") }))));
  assert.deepEqual(Object.fromEntries(built.outputs), { "ghg-version": "1.2.0", site: "docs/public/site" });
  const nothing = new FakeRunner({ build: "true" });
  await runAction(OPTIONS, ports(nothing, new FakeGhgProcess(ghgReport({ outcome: "nothing-to-build", output: null }))));
  assert.deepEqual(Object.fromEntries(nothing.outputs), { "ghg-version": "1.2.0", site: "" });
  const installed = new FakeRunner();
  await runAction(OPTIONS, ports(installed));
  assert.deepEqual(Object.fromEntries(installed.outputs), { "ghg-version": "1.2.0", site: "" });
});

test("building with a ghg older than 1.1.0 stops the action before anything is downloaded", async () => {
  const runner = new FakeRunner({ build: "true", "ghg-version": "1.0.0" });
  const used = ports(runner);
  await runAction(OPTIONS, used);
  assert.deepEqual(runner.failures, ["The action builds with ghg 1.1.0 or newer, not 1.0.0."]);
  assert.deepEqual(runner.path, []);
  const installed = new FakeRunner({ "ghg-version": "1.2.0" });
  await runAction(OPTIONS, ports(installed));
  assert.deepEqual(installed.failures, []);
});

test("building reports every input the ghg named is too old for, each a failure of its own", async () => {
  const runner = new FakeRunner({ build: "true", "ghg-version": "1.0.0", "keep-in-output": "/CNAME", title: "Shop" });
  await runAction({ ...OPTIONS, since: { ...OPTIONS.since, title: "1.2.0" } }, ports(runner));
  assert.deepEqual(runner.failures, [
    "The action builds with ghg 1.1.0 or newer, not 1.0.0.",
    "title needs ghg 1.2.0 or newer, not 1.0.0.",
    "keep-in-output needs ghg 1.1.0 or newer, not 1.0.0.",
  ]);
  assert.deepEqual(runner.path, []);
});
