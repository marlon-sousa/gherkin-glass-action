// Steps: running the root action, and what its step shows.

import assert from "node:assert/strict";
import { Then, When, type DataTable } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../support/world.ts";

export const PUSH = { name: "push", payload: { ref: "refs/heads/main", repository: { full_name: "owner/repo" } } } as const;

When("a push runs the action with:", function (this: ScenarioWorld, inputs: DataTable) {
  this.pending = { action: "./", inputs: inputs.rowsHash(), event: PUSH };
});

When("a later step runs {string}", function (this: ScenarioWorld, command: string) {
  this.laterStep = command;
});

Then("the action passes", function (this: ScenarioWorld) {
  assert.ok(this.ran.actionPassed, "The action's step failed.");
});

Then("the action fails with {string}", function (this: ScenarioWorld, sentence: string) {
  assert.ok(!this.ran.actionPassed, "The action's step passed.");
  const errors = this.ran.annotations.filter((annotation) => annotation.kind === "error" && annotation.file === undefined);
  assert.deepEqual(errors.map((error) => error.message), [sentence]);
});

Then("the action fails with:", function (this: ScenarioWorld, sentences: DataTable) {
  assert.ok(!this.ran.actionPassed, "The action's step passed.");
  const errors = this.ran.annotations.filter((annotation) => annotation.kind === "error" && annotation.file === undefined);
  assert.deepEqual(errors.map((error) => error.message), sentences.raw().map(([sentence]) => sentence));
});

Then("the log says {string}", function (this: ScenarioWorld, line: string) {
  assert.ok(this.ran.log.includes(line), `The log does not say: ${line}`);
});

Then("the log does not say {string}", function (this: ScenarioWorld, line: string) {
  assert.ok(!this.ran.log.includes(line), `The log says: ${line}`);
});

Then("the output {string} is {string}", function (this: ScenarioWorld, name: string, value: string) {
  assert.equal(this.ran.outputs.get(name) ?? "", value);
});

Then("there is a notice saying {string}", function (this: ScenarioWorld, message: string) {
  assert.ok(this.ran.annotations.some((annotation) => annotation.kind === "notice" && annotation.message === message));
});

Then(
  "there is an error annotation on {string}, line {int}, saying {string}",
  function (this: ScenarioWorld, file: string, line: number, message: string) {
    assert.ok(
      this.ran.annotations.some((annotation) => annotation.file === file && annotation.line === line && annotation.message === message),
      `No such annotation among ${JSON.stringify(this.ran.annotations)}`,
    );
  },
);
