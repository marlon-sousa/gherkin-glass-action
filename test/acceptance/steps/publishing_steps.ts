// Steps: GitHub Pages, the branch it serves, and the publish and preview actions run on it.

import assert from "node:assert/strict";
import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../support/world.ts";
import { PUSH } from "./action_steps.ts";

/** The address Pages gives the repository's site. */
const SITE = "https://owner.github.io/repo/";
/** The commit at the head of the pull request the scenarios open. */
export const HEAD = "b".repeat(40);

Given("Pages deploys from the branch {string}, serving {string}", async function (this: ScenarioWorld, branch: string, folder: string) {
  await this.wireMock.answer("GET", "/pages", 200, {
    build_type: "legacy",
    source: { branch, path: folder },
    html_url: SITE,
  });
});

Given("Pages deploys with a workflow", async function (this: ScenarioWorld) {
  await this.wireMock.answer("GET", "/pages", 200, { build_type: "workflow", html_url: SITE });
});

Given("the branch {string} holds:", function (this: ScenarioWorld, branch: string, files: DataTable) {
  this.siteRepository.giveBranch(branch, Object.fromEntries(files.raw().map(([file = ""]) => [file, file === "CNAME" ? "features.example.com\n" : ""])));
});

Given("the token may not push", function (this: ScenarioWorld) {
  this.gitServer.refusingPushes = true;
});

Given("a push has published the site", async function (this: ScenarioWorld) {
  await this.runBeforehand({ action: "./publish", inputs: { "ghg-version": "1.1.0" }, event: PUSH });
});

Given("pull request #{int} has its preview on the branch", async function (this: ScenarioWorld, number: number) {
  await this.wireMock.answer("GET", `/issues/${number}/comments`, 200, []);
  await this.wireMock.answer("POST", `/issues/${number}/comments`, 201, { id: 1 });
  await this.runBeforehand({ action: "./preview", inputs: { "ghg-version": "1.1.0" }, event: pullRequestEvent(number, "opened", "owner/repo") });
  await this.wireMock.forgetRequests();
});

When("a push runs the publish action with:", function (this: ScenarioWorld, inputs: DataTable) {
  this.pending = { action: "./publish", inputs: inputs.rowsHash(), event: PUSH };
});

When(
  "a push of the branch {string} runs the publish action with:",
  function (this: ScenarioWorld, branch: string, inputs: DataTable) {
    const event = { name: "push", payload: { ...PUSH.payload, ref: `refs/heads/${branch}` } } as const;
    this.pending = { action: "./publish", inputs: inputs.rowsHash(), event };
  },
);

When("a push runs the preview action with:", function (this: ScenarioWorld, inputs: DataTable) {
  this.pending = { action: "./preview", inputs: inputs.rowsHash(), event: PUSH };
});

When(
  "pull request #{int} is {word}, and runs the preview action with:",
  function (this: ScenarioWorld, number: number, action: string, inputs: DataTable) {
    this.pending = { action: "./preview", inputs: inputs.rowsHash(), event: pullRequestEvent(number, action, "owner/repo") };
  },
);

When("pull request #{int} from a fork runs the preview action", function (this: ScenarioWorld, number: number) {
  this.pending = { action: "./preview", inputs: { "ghg-version": "1.1.0" }, event: pullRequestEvent(number, "opened", "someone/repo") };
});

Then("the branch {string} holds {string}", function (this: ScenarioWorld, branch: string, file: string) {
  assert.ok(this.siteRepository.filesOf(branch).includes(file), `${branch} does not hold ${file}: ${this.siteRepository.filesOf(branch).join(", ")}`);
});

Then("the branch {string} does not hold {string}", function (this: ScenarioWorld, branch: string, file: string) {
  assert.ok(!this.siteRepository.filesOf(branch).some((held) => held === file || held.startsWith(`${file}/`)));
});

Then("the branch {string} has {int} commit(s)", function (this: ScenarioWorld, branch: string, commits: number) {
  assert.equal(this.siteRepository.commitsOf(branch), commits);
});

Then("the newest commit of {string} says {string}", function (this: ScenarioWorld, branch: string, subject: string) {
  assert.equal(this.siteRepository.lastSubjectOf(branch), subject);
});

function pullRequestEvent(number: number, action: string, headRepository: string) {
  const repository = { full_name: "owner/repo" };
  return {
    name: "pull_request",
    payload: {
      action,
      number,
      pull_request: { number, head: { sha: HEAD, ref: "feature", repo: { full_name: headRepository } }, base: { ref: "main", repo: repository } },
      repository,
    },
  } as const;
}
