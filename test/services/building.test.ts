// Tests docs/BEHAVIOUR.md, rules 7 and 10: running ghg build, reading its report and annotating its problems.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { buildSite } from "../../src/services/building.ts";
import { FakeFiles, FakeGhgProcess, FakeRunner, ghgReport } from "../support/fakes.ts";

const REQUEST = { buildArguments: ["--preview"], input: "", frontPage: "", configFile: "docs/ghg.toml" };

function stopsWith(message: string) {
  return (error: unknown) => error instanceof ActionStop && error.message === message;
}

test("ghg build runs with the arguments of the inputs and the report the action reads, and gives the folder it wrote", async () => {
  const process = new FakeGhgProcess(ghgReport({ output: "docs/site" }));
  const built = await buildSite("tools/ghg", REQUEST, { runner: new FakeRunner(), process, files: new FakeFiles() });
  assert.deepEqual(process.runs, [["tools/ghg", "build", "--preview", "--message-format=json"]]);
  assert.deepEqual(built, { outcome: "built", output: "docs/site" });
});

test("nothing to build passes, and says so", async () => {
  const process = new FakeGhgProcess(ghgReport({ outcome: "nothing-to-build", output: null }));
  const built = await buildSite("ghg", REQUEST, { runner: new FakeRunner(), process, files: new FakeFiles() });
  assert.deepEqual(built, { outcome: "nothing-to-build" });
});

test("each problem naming a file and a line is annotated, relative to the configured input folder", async () => {
  const runner = new FakeRunner();
  const errors = [
    { path: "docs/ghg.toml", line: 2, message: "ghg has no setting named colour." },
    { path: "a.feature", line: 5, message: "Syntax error." },
    { path: "b.feature", line: null, message: "cannot be read: denied" },
  ];
  const process = new FakeGhgProcess(ghgReport({ outcome: "stopped", output: null, errors }), 1);
  const files = new FakeFiles({ "docs/ghg.toml": 'input = "../specs"\ncolour = 1' });
  await assert.rejects(buildSite("ghg", REQUEST, { runner, process, files }), stopsWith("ghg build stopped with status 1."));
  assert.deepEqual(runner.annotations, [
    { file: "docs/ghg.toml", line: 2, message: "ghg has no setting named colour." },
    { file: "specs/a.feature", line: 5, message: "Syntax error." },
  ]);
});

test("a build that stops without a report, such as at a mistake on the command line, stops with its status", async () => {
  const process = new FakeGhgProcess("", 2);
  await assert.rejects(
    buildSite("ghg", REQUEST, { runner: new FakeRunner(), process, files: new FakeFiles() }),
    stopsWith("ghg build stopped with status 2."),
  );
});

test("a build that passes without a report it can read stops the action", async () => {
  for (const printed of ["", "not json\n", ghgReport({ outcome: "stopped" })]) {
    await assert.rejects(
      buildSite("ghg", REQUEST, { runner: new FakeRunner(), process: new FakeGhgProcess(printed), files: new FakeFiles() }),
      stopsWith("ghg build gave no report of how it ended."),
      printed,
    );
  }
});
