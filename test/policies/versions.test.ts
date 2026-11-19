// Tests docs/BEHAVIOUR.md, rules 2, 3 and 11: the release of ghg the action installs.

import assert from "node:assert/strict";
import { test } from "node:test";
import packageJson from "../../package.json" with { type: "json" };
import pairedGhg from "../../paired-ghg.json" with { type: "json" };
import { majorOf, namedVersion, newestStable, type ReleaseListing } from "../../src/policies/versions.ts";

const PROBLEM = { problem: "ghg-version must be a version of ghg, such as 1.2.0." };

test("ghg-version names a version, with or without the tag's v, pre-releases included", () => {
  assert.equal(namedVersion("1.2.0"), "1.2.0");
  assert.equal(namedVersion("v1.2.0"), "1.2.0");
  assert.equal(namedVersion("1.3.0-rc.1"), "1.3.0-rc.1");
  assert.equal(namedVersion("v0.1.0-alpha.2"), "0.1.0-alpha.2");
  assert.equal(namedVersion("1.0.0-0.x-y.007a"), "1.0.0-0.x-y.007a");
});

test("anything that is not a version stops the action", () => {
  for (const input of ["1", "1.2", "1.x", "latest", "01.2.0", "1.2.0+build.5", " 1.2.0", "vv1.2.0", "1.2.0-", "1.0.0-01", "1.0.0-rc.01", "1.0.0-rc..1"]) {
    assert.deepEqual(namedVersion(input), PROBLEM, input);
  }
});

function release(tag: string, draft = false, prerelease = false): ReleaseListing {
  return { tag, draft, prerelease };
}

test("the default is the newest stable release of the major version", () => {
  const releases = [release("v1.0.0"), release("v1.10.0"), release("v1.9.3"), release("v2.0.0"), release("v0.9.0")];
  assert.equal(newestStable(releases, 1), "1.10.0");
  assert.equal(newestStable(releases, 2), "2.0.0");
});

test("drafts, pre-releases and tags that are not plain versions never count", () => {
  const releases = [
    release("v1.0.0"),
    release("v1.1.0", true),
    release("v1.2.0", false, true),
    release("v1.3.0-rc.1"),
    release("1.4.0"),
    release("v1.05.0"),
    release("v1"),
  ];
  assert.equal(newestStable(releases, 1), "1.0.0");
});

test("no release of the major version gives none", () => {
  assert.equal(newestStable([release("v2.0.0"), release("v1.0.0-rc.1", false, true)], 1), undefined);
  assert.equal(newestStable([], 1), undefined);
});

test("the action's major version is that of its paired ghg", () => {
  assert.ok(namedVersion(pairedGhg.version) === pairedGhg.version, "paired-ghg.json names a version");
  assert.equal(majorOf(packageJson.version), majorOf(pairedGhg.version));
  assert.equal(majorOf("12.3.4"), 12);
});
