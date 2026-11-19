// Tests docs/BEHAVIOUR.md, rules 7 and 10: running ghg build and annotating its report.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { buildSite } from "../../src/services/building.ts";
import { FakeFiles, FakeGhgProcess, FakeRunner } from "../support/fakes.ts";

const REQUEST = { buildArguments: ["--preview"], input: "", frontPage: "", configFile: "docs/ghg.toml" };

test("ghg build runs with the arguments of the inputs", async () => {
  const process = new FakeGhgProcess();
  await buildSite("tools/ghg", REQUEST, { runner: new FakeRunner(), process, files: new FakeFiles() });
  assert.deepEqual(process.runs, [["tools/ghg", "build", "--preview"]]);
});

test("each line naming a file and a line is annotated, relative to the configured input folder", async () => {
  const runner = new FakeRunner();
  const process = new FakeGhgProcess(
    ["docs/ghg.toml:2: ghg has no setting named colour.", "a.feature:5: Syntax error.", "b.feature: cannot be read: denied"],
    1,
  );
  const files = new FakeFiles({ "docs/ghg.toml": 'input = "../specs"\ncolour = 1' });
  await assert.rejects(
    buildSite("ghg", REQUEST, { runner, process, files }),
    (error) => error instanceof ActionStop && error.message === "ghg build stopped with status 1.",
  );
  assert.deepEqual(runner.annotations, [
    { file: "docs/ghg.toml", line: 2, message: "ghg has no setting named colour." },
    { file: "specs/a.feature", line: 5, message: "Syntax error." },
  ]);
});
