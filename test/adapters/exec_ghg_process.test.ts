// Tests docs/BEHAVIOUR.md, rule 10: each line of the build's standard error reaches the annotations.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecGhgProcess } from "../../src/adapters/exec_ghg_process.ts";

test("each line of standard error is given alone, with the exit status", async () => {
  const lines: string[] = [];
  // As ghg writes its report: lines ending in \n alone, on every system.
  const script = 'process.stderr.write("a.feature:1: x\\nb.feature:2: y\\r\\nc.feature: z\\n"); process.exitCode = 3';
  const status = await new ExecGhgProcess().run(process.execPath, ["-e", script], (line) => lines.push(line));
  assert.equal(status, 3);
  assert.deepEqual(lines, ["a.feature:1: x", "b.feature:2: y", "c.feature: z"]);
});

test("the last line is given even without a line ending", async () => {
  const lines: string[] = [];
  const script = 'process.stderr.write("a.feature:1: x\\nb.feature:2: y")';
  await new ExecGhgProcess().run(process.execPath, ["-e", script], (line) => lines.push(line));
  assert.deepEqual(lines, ["a.feature:1: x", "b.feature:2: y"]);
});
