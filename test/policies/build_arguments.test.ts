// Tests docs/BEHAVIOUR.md, rules 7, 8 and 9: the arguments of ghg build, from every input of action.yml.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BUILD_OPTIONS, OWN_INPUTS, buildArguments, buildAsked, linesOf } from "../../src/policies/build_arguments.ts";

function argumentsOf(inputs: Record<string, string>) {
  return buildArguments((name) => inputs[name] ?? "");
}

test("build is false by default, and true only when it says so", () => {
  assert.equal(buildAsked(""), false);
  assert.equal(buildAsked("false"), false);
  assert.equal(buildAsked("true"), true);
  for (const input of ["yes", "True", "1"]) {
    assert.deepEqual(buildAsked(input), { problem: "build must be true or false." }, input);
  }
});

test("empty inputs are left out, so that the configuration file applies", () => {
  assert.deepEqual(argumentsOf({}), []);
  assert.deepEqual(argumentsOf({ preview: "false" }), []);
});

test("each input that is not empty is passed as --<name>=<value>, in the order of ghg build --help", () => {
  assert.deepEqual(
    argumentsOf({
      preview: "true",
      only: "changed.txt",
      "front-page": "front.md",
      "version-name": "1.2",
      title: "The suite, = with an equals",
      output: "public",
      input: "specs folder",
      config: "docs/ghg.toml",
    }),
    [
      "--config=docs/ghg.toml",
      "--input=specs folder",
      "--output=public",
      "--title=The suite, = with an equals",
      "--version-name=1.2",
      "--front-page=front.md",
      "--only=changed.txt",
      "--preview",
    ],
  );
});

test("keep-in-output is passed once for each line, in their order, without the empty ones", () => {
  assert.deepEqual(argumentsOf({ "keep-in-output": ".nojekyll\n\n  \r\nnotes/\r\n!notes/draft.md" }), [
    "--keep-in-output=.nojekyll",
    "--keep-in-output=notes/",
    "--keep-in-output=!notes/draft.md",
  ]);
  assert.deepEqual(linesOf(""), []);
});

test("a flag that is neither true nor false stops the action", () => {
  assert.deepEqual(argumentsOf({ preview: "yes" }), { problem: "preview must be true or false." });
});

test("every input of action.yml is passed to the build, or is one of the action's own", () => {
  const actionYml = readFileSync(new URL("../../action.yml", import.meta.url), "utf8");
  const inputsSection = actionYml.split(/^inputs:$/m)[1]?.split(/^\S/m)[0] ?? "";
  const inputs = [...inputsSection.matchAll(/^ {2}([a-z-]+):$/gm)].map((match) => match[1]);
  assert.deepEqual(inputs, [...OWN_INPUTS, ...BUILD_OPTIONS.map((option) => option.name)]);
  const every = Object.fromEntries(BUILD_OPTIONS.map((option) => [option.name, option.takes === "nothing" ? "true" : "x"]));
  const passed = argumentsOf(every);
  assert.ok(Array.isArray(passed));
  assert.equal(passed.length, BUILD_OPTIONS.length);
});
