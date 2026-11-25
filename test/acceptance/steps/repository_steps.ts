// Steps: the repository the workflow runs in, and the workspace the job leaves.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Given, Then } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../support/world.ts";

const FEATURE = "Feature: Basket\n\n  Scenario: Adding an item\n    Given an empty basket\n    When I add an apple\n    Then the basket holds an apple\n";

Given("the repository holds the feature file {string}", function (this: ScenarioWorld, file: string) {
  this.files[file] = FEATURE;
});

Given("the repository holds the file {string} with {string}", function (this: ScenarioWorld, file: string, text: string) {
  this.files[file] = text;
});

Then("the workspace holds {string}", function (this: ScenarioWorld, file: string) {
  assert.ok(existsSync(path.join(this.ran.workspace, file)), `${file} is not in the workspace.`);
});

Then("the workspace does not hold {string}", function (this: ScenarioWorld, file: string) {
  assert.ok(!existsSync(path.join(this.ran.workspace, file)), `${file} is in the workspace.`);
});

Then("the page {string} says {string}", function (this: ScenarioWorld, file: string, text: string) {
  assert.ok(readFileSync(path.join(this.ran.workspace, file), "utf8").includes(text), `${file} does not say ${text}.`);
});
