// Steps: the comment that gives a pull request its preview's address, and the files it changes, through GitHub's API.

import assert from "node:assert/strict";
import { Given, Then, type DataTable } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../support/world.ts";
import { HEAD } from "./publishing_steps.ts";

const COMMENT = 7;
const MARKER = "<!-- gherkin-glass-action preview -->";

Given("pull request #{int} has no comment", async function (this: ScenarioWorld, number: number) {
  await this.wireMock.answer("GET", `/issues/${number}/comments`, 200, []);
  await this.wireMock.answer("POST", `/issues/${number}/comments`, 201, { id: COMMENT });
});

Given("pull request #{int} has no comment, and none may be written", async function (this: ScenarioWorld, number: number) {
  await this.wireMock.answer("GET", `/issues/${number}/comments`, 200, []);
  await this.wireMock.answer("POST", `/issues/${number}/comments`, 403, { message: "Resource not accessible by integration" });
});

Given(
  "pull request #{int} has the preview's comment, built from {string}",
  async function (this: ScenarioWorld, number: number, commit: string) {
    const body = `${MARKER}\n<!-- built from ${commit} -->\nThe preview of this pull request's feature files is at somewhere.`;
    await this.wireMock.answer("GET", `/issues/${number}/comments`, 200, [{ id: COMMENT, body }]);
    await this.wireMock.answer("PATCH", `/issues/comments/${COMMENT}`, 200, { id: COMMENT });
  },
);

Given("pull request #{int} changes:", async function (this: ScenarioWorld, number: number, files: DataTable) {
  const changed = files.hashes().map(({ file, status }) => ({ filename: file, status }));
  await this.wireMock.answer("GET", `/pulls/${number}/files`, 200, changed);
});

Given("the commits since {string} change:", async function (this: ScenarioWorld, commit: string, files: DataTable) {
  const changed = files.hashes().map(({ file, status }) => ({ filename: file, status }));
  await this.wireMock.answer("GET", `/compare/${commit}...${HEAD}`, 200, { status: "ahead", files: changed });
});

Then("a comment is added saying {string}", async function (this: ScenarioWorld, expected: string) {
  const written = await commentsWritten(this);
  assert.equal(written.length, 1, `Comments written: ${JSON.stringify(written)}`);
  assert.ok(written[0]?.method === "POST" && written[0].url.startsWith("/repos/owner/repo/issues/12/comments"));
  assert.ok(written[0].body.includes(lineBreaksOf(expected)), `The comment says ${written[0].body}`);
});

Then("the preview's comment is edited to say {string}", async function (this: ScenarioWorld, expected: string) {
  const written = await commentsWritten(this);
  assert.equal(written.length, 1, `Comments written: ${JSON.stringify(written)}`);
  assert.ok(written[0]?.method === "PATCH" && written[0].url === `/repos/owner/repo/issues/comments/${COMMENT}`);
  assert.ok(written[0].body.includes(lineBreaksOf(expected)), `The comment says ${written[0].body}`);
});

Then("no comment is written", async function (this: ScenarioWorld) {
  assert.deepEqual(await commentsWritten(this), []);
});

// A feature file writes a line break of the comment as \\n.
function lineBreaksOf(text: string): string {
  return text.replaceAll("\\n", "\n");
}

// Oldest first.
async function commentsWritten(world: ScenarioWorld): Promise<{ method: string; url: string; body: string }[]> {
  const requests = await world.wireMock.requests();
  return requests
    .filter((request) => request.method === "POST" || request.method === "PATCH")
    .map((request) => ({ ...request, body: String((JSON.parse(request.body) as { body?: unknown }).body) }));
}
