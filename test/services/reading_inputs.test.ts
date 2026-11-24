// Tests docs/BEHAVIOUR.md, "The action": every input of the root action is checked before anything is downloaded.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { readRequest } from "../../src/services/reading_inputs.ts";
import { FakeRunner } from "../support/fakes.ts";

function stops(runner: FakeRunner, message: string) {
  assert.throws(() => readRequest(runner), (error) => error instanceof ActionStop && error.message === message);
}

test("the defaults install the newest ghg and build nothing", () => {
  const request = readRequest(new FakeRunner());
  assert.equal(request.install.version, undefined);
  assert.equal(request.build, undefined);
  assert.equal(request.install.platform.target, "x86_64-unknown-linux-musl");
  assert.equal(request.install.releasesToken, undefined);
});

test("the token is sent only on github.com", () => {
  assert.equal(readRequest(new FakeRunner({ token: "a-token" })).install.releasesToken, "a-token");
  assert.equal(readRequest(new FakeRunner({ token: "a-token" }, "Linux", "X64", false)).install.releasesToken, undefined);
});

test("a build is asked with its arguments, its folders and its configuration file", () => {
  const request = readRequest(
    new FakeRunner({ "ghg-version": "v1.2.0", build: "true", input: "specs", output: "public", title: "T" }),
  );
  assert.equal(request.install.version, "1.2.0");
  assert.deepEqual(request.build, {
    buildArguments: ["--input=specs", "--output=public", "--title=T"],
    input: "specs",
    frontPage: "",
    configFile: "ghg.toml",
  });
});

test("each input that cannot be used stops the action", () => {
  stops(new FakeRunner({ "ghg-version": "latest" }), "ghg-version must be a version of ghg, such as 1.2.0.");
  stops(new FakeRunner({ build: "yes" }), "build must be true or false.");
  stops(new FakeRunner({ preview: "yes" }), "preview must be true or false.");
  stops(new FakeRunner({}, "Linux", "ARM"), "ghg has no build for Linux on ARM.");
});
