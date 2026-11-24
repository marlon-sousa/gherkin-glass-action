// Tests docs/BEHAVIOUR.md, rule 19: the inputs the publish and preview actions share are checked before anything is downloaded.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { readSiteRequest } from "../../src/services/reading_site_inputs.ts";
import { FakeRunner } from "../support/fakes.ts";

const DEFAULTS = { to: "github-pages", branch: "gh-pages", token: "a-token" };

test("the shared inputs name the branch, the folder, the token and the build", () => {
  const request = readSiteRequest(
    new FakeRunner({
      ...DEFAULTS,
      folder: "features",
      "ghg-version": "1.2.0",
      title: "T",
      "front-page": "front.md",
      "keep-in-output": "README.md",
    }),
  );
  assert.equal(request.branch, "gh-pages");
  assert.equal(request.folder, "features");
  assert.equal(request.token, "a-token");
  assert.equal(request.install.version, "1.2.0");
  assert.equal(request.install.releasesToken, "a-token");
  assert.deepEqual(request.build, {
    buildArguments: ["--title=T", "--front-page=front.md"],
    input: "",
    frontPage: "front.md",
    configFile: "ghg.toml",
  });
  assert.equal(request.keepInOutput, "README.md");
});

test("the token reads Pages and pushes on any server, though it lists releases only on github.com", () => {
  const request = readSiteRequest(new FakeRunner(DEFAULTS, "Linux", "X64", false));
  assert.equal(request.token, "a-token");
  assert.equal(request.install.releasesToken, undefined);
});

test("an input the action does not take is not passed to ghg build", () => {
  const request = readSiteRequest(new FakeRunner({ ...DEFAULTS, output: "public", preview: "yes", only: "list.txt" }));
  assert.deepEqual(request.build.buildArguments, []);
  assert.equal(request.build.input, "");
});

test("an input that cannot be used stops the action", () => {
  assert.throws(
    () => readSiteRequest(new FakeRunner({ ...DEFAULTS, to: "s3" })),
    (error) => error instanceof ActionStop && error.message === "to must be github-pages.",
  );
  assert.throws(
    () => readSiteRequest(new FakeRunner({ ...DEFAULTS, "ghg-version": "latest" })),
    (error) => error instanceof ActionStop && error.message === "ghg-version must be a version of ghg, such as 1.2.0.",
  );
});
