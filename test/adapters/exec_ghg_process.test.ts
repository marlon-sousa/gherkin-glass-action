// Tests docs/BEHAVIOUR.md, rule 7: the build's standard output, which holds its report, reaches the action whole.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecGhgProcess } from "../../src/adapters/exec_ghg_process.ts";

test("standard output is given whole, with the exit status", async () => {
  const script = 'process.stdout.write("{\\"outcome\\":"); process.stdout.write("\\"stopped\\"}\\n"); process.exitCode = 3';
  const run = await new ExecGhgProcess().run(process.execPath, ["-e", script]);
  assert.deepEqual(run, { status: 3, standardOutput: '{"outcome":"stopped"}\n' });
});

test("a character cut between two chunks is joined again", async () => {
  // é is two bytes in UTF-8, written one at a time.
  const script = 'process.stdout.write(Buffer.from([0xc3])); setTimeout(() => process.stdout.write(Buffer.from([0xa9])), 50)';
  const run = await new ExecGhgProcess().run(process.execPath, ["-e", script]);
  assert.equal(run.standardOutput, "é");
});
