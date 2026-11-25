// Tests rules 2 and 9: the release of ghg each option needs, and ghg-options.json itself.

import assert from "node:assert/strict";
import { test } from "node:test";
import OPTIONS from "../../ghg-options.json" with { type: "json" };
import { ACTION_OPTIONS, BUILD_OPTIONS } from "../../src/policies/build_arguments.ts";
import { optionsOf, tooOldFor } from "../../src/policies/ghg_options.ts";
import { PREVIEW_OPTIONS, PUBLISH_OPTIONS } from "../../src/policies/site_inputs.ts";
import { isOlder, namedVersion } from "../../src/policies/versions.ts";

const MAP = { tested: "1.2.0", since: { title: "1.0.0", "keep-in-output": "1.1.0", "message-format": "1.1.0", "source-link": "1.2.0" } };

test("a release with every option passed gives no sentence", () => {
  const passed = { byInputs: ["title", "keep-in-output", "source-link"], byAction: ["message-format"] };
  for (const version of ["1.2.0", "1.3.0", "2.0.0"]) assert.deepEqual(tooOldFor(version, passed, MAP), [], version);
});

test("every option too new is reported, the action's own once with the newest release among them, then each input", () => {
  const passed = { byInputs: ["title", "source-link", "keep-in-output"], byAction: ["message-format", "title"] };
  assert.deepEqual(tooOldFor("1.0.0", passed, MAP), [
    "The action builds with ghg 1.1.0 or newer, not 1.0.0.",
    "source-link needs ghg 1.2.0 or newer, not 1.0.0.",
    "keep-in-output needs ghg 1.1.0 or newer, not 1.0.0.",
  ]);
  const newest = { byInputs: [], byAction: ["keep-in-output", "source-link", "title"] };
  assert.deepEqual(tooOldFor("1.0.0", newest, MAP), ["The action builds with ghg 1.2.0 or newer, not 1.0.0."]);
});

test("a pre-release comes before its release, and an option the map does not name needs nothing", () => {
  const passed = { byInputs: ["source-link", "unknown"], byAction: [] };
  assert.deepEqual(tooOldFor("1.2.0-rc.1", passed, MAP), ["source-link needs ghg 1.2.0 or newer, not 1.2.0-rc.1."]);
});

test("the options of the arguments, without their dashes or values, each once", () => {
  assert.deepEqual(optionsOf(["--title=Shop", "--preview", "--keep-in-output=/a", "--keep-in-output=/b"]), ["title", "preview", "keep-in-output"]);
});

test("ghg-options.json names every option of an input and the action's own, from plain releases no newer than tested", () => {
  const named = Object.keys(OPTIONS.since).sort();
  assert.deepEqual(named, [...BUILD_OPTIONS.map((option) => option.name), ...ACTION_OPTIONS].sort());
  for (const option of [...PUBLISH_OPTIONS, ...PREVIEW_OPTIONS]) assert.ok(named.includes(option), option);
  for (const release of [OPTIONS.tested, ...Object.values(OPTIONS.since)]) {
    assert.ok(namedVersion(release) === release && !release.includes("-"), `${release} is a plain release`);
    assert.ok(!isOlder(OPTIONS.tested, release), `${release} is no newer than tested`);
  }
});
