// Tests docs/BEHAVIOUR.md, "The action" and rules 3 and 10: the action from its inputs to its end.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import { runAction } from "../../src/services/running_action.ts";
import { FakeFiles, FakeGhgProcess, FakeReleases, FakeRunner, FakeToolCache } from "../support/fakes.ts";

const ARCHIVE = "ghg-v1.2.0-x86_64-unknown-linux-musl.tar.gz";
const SUM = "e".repeat(64);

function ports(runner: FakeRunner, process = new FakeGhgProcess(), releases: GhgReleases = sound()) {
  const tokens: (string | undefined)[] = [];
  return {
    tokens,
    runner,
    process,
    toolCache: new FakeToolCache(),
    releasesWith: (token: string | undefined) => {
      tokens.push(token);
      return releases;
    },
    files: new FakeFiles(
      { "downloads/v1.2.0/SHA256SUMS": `${SUM}  ${ARCHIVE}\n`, [path.join(`unpacked/downloads/v1.2.0/${ARCHIVE}`, "ghg")]: "" },
      { [`downloads/v1.2.0/${ARCHIVE}`]: SUM },
    ),
  };
}

function sound() {
  return new FakeReleases([{ tag: "v1.2.0", draft: false, prerelease: false }], {
    [`v1.2.0/${ARCHIVE}`]: "",
    "v1.2.0/SHA256SUMS": "",
  });
}

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
