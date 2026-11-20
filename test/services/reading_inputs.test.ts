// Tests docs/BEHAVIOUR.md, "The action": every input is checked before anything is downloaded.

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
  assert.equal(request.version, undefined);
  assert.equal(request.build, undefined);
  assert.equal(request.publish, undefined);
  assert.equal(request.platform.target, "x86_64-unknown-linux-musl");
  assert.equal(request.token, undefined);
});

test("the token is sent only on github.com", () => {
  assert.equal(readRequest(new FakeRunner({ token: "a-token" })).token, "a-token");
  assert.equal(readRequest(new FakeRunner({ token: "a-token" }, "Linux", "X64", false)).token, undefined);
});

test("a build is asked with its arguments, its input and its configuration file", () => {
  const request = readRequest(new FakeRunner({ "ghg-version": "v1.2.0", build: "true", input: "specs", title: "T" }));
  assert.equal(request.version, "1.2.0");
  assert.deepEqual(request.build, {
    buildArguments: ["--input=specs", "--title=T"],
    input: "specs",
    frontPage: "",
    configFile: "ghg.toml",
  });
});

test("each input that cannot be used stops the action", () => {
  stops(new FakeRunner({ "ghg-version": "latest" }), "ghg-version must be a version of ghg, such as 1.2.0.");
  stops(new FakeRunner({ build: "yes" }), "build must be true or false.");
  stops(new FakeRunner({ preview: "yes" }), "preview must be true or false.");
  stops(new FakeRunner({}, "Windows", "ARM64"), "ghg has no build for Windows on ARM64.");
});

test("publish asks for a target from the event, with the build's arguments but version-name", () => {
  const runner = new FakeRunner({
    publish: "true",
    "publish-branch": "gh-pages",
    "publish-folder": "features",
    token: "a-token",
    title: "T",
    "version-name": "latest",
  });
  runner.event = { name: "push", refName: "v1.2.0", payload: {} };
  assert.deepEqual(readRequest(runner).publish, {
    branch: "gh-pages",
    folder: "features",
    changedOnly: false,
    target: { kind: "version", versionName: "latest", folder: "features" },
    token: "a-token",
    build: { buildArguments: ["--title=T"], input: "", frontPage: "", configFile: "ghg.toml" },
  });
});

test("publish on an event that publishes nothing, or with an input it decides, stops the action", () => {
  const dispatched = new FakeRunner({ publish: "true", "publish-branch": "gh-pages" });
  dispatched.event = { name: "workflow_dispatch", refName: "main", payload: {} };
  stops(dispatched, "publish acts on a push or a pull request, not on workflow_dispatch.");
  stops(
    new FakeRunner({ publish: "true", "publish-branch": "gh-pages", output: "public" }),
    "publish writes the site into publish-branch, so output must be empty.",
  );
});
