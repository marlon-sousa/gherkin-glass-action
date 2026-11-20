// Tests docs/BEHAVIOUR.md, rules 10 and 18: where the files ghg build reads and writes are, found as ghg finds them.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { configFileOf, outputFolderOf, reportPathsOf, type BuildSettings } from "../../src/policies/report_paths.ts";

function settings(given: Partial<BuildSettings>): BuildSettings {
  return { input: "", output: "", frontPage: "", configFile: "ghg.toml", configText: undefined, ...given };
}

function paths(given: Partial<BuildSettings>) {
  return reportPathsOf(settings(given));
}

test("the configuration file is the input config, or ghg.toml", () => {
  assert.equal(configFileOf(""), "ghg.toml");
  assert.equal(configFileOf("docs/site.toml"), "docs/site.toml");
});

test("the input input wins over the configuration file", () => {
  assert.equal(paths({ input: "specs", configText: 'input = "other"' }).inputFolder, "specs");
});

test("the configuration's input is relative to the file's folder, unless it is whole", () => {
  assert.equal(paths({ configText: 'input = "specs"' }).inputFolder, "specs");
  assert.equal(paths({ configFile: "docs/ghg.toml", configText: 'title = "x"\ninput = "../specs"' }).inputFolder, "specs");
  const whole = path.resolve("/srv/specs");
  assert.equal(paths({ configFile: "docs/ghg.toml", configText: `input = ${JSON.stringify(whole)}` }).inputFolder, whole);
});

test("without a key, the default features is relative to the file's folder", () => {
  assert.equal(paths({ configFile: "docs/ghg.toml", configText: 'title = "x"' }).inputFolder, path.join("docs", "features"));
});

test("without a file, the default features is relative to the workspace", () => {
  assert.equal(paths({ configFile: "docs/ghg.toml" }).inputFolder, "features");
});

test("a file ghg cannot read, or an input that is not text, gives the default", () => {
  assert.equal(paths({ configText: "input = " }).inputFolder, "features");
  assert.equal(paths({ configText: "input = 3" }).inputFolder, "features");
});

test("the configuration file and the front page are named from the workspace", () => {
  assert.deepEqual(paths({ configFile: "./ghg.toml" }).workspaceFiles, ["ghg.toml"]);
  assert.deepEqual(paths({ frontPage: "front.md", configText: 'front_page = "other.md"' }).workspaceFiles, [
    "ghg.toml",
    "front.md",
  ]);
  assert.deepEqual(paths({ configFile: "docs/ghg.toml", configText: 'front_page = "front.md"' }).workspaceFiles, [
    path.join("docs", "ghg.toml"),
    path.join("docs", "front.md"),
  ]);
});

test("the output folder is the input output, else the configuration's, relative to its folder, else site", () => {
  assert.equal(outputFolderOf(settings({ output: "public", configText: 'output = "other"' })), "public");
  assert.equal(outputFolderOf(settings({ configFile: "docs/ghg.toml", configText: 'output = "../public"' })), "public");
  assert.equal(outputFolderOf(settings({ configFile: "docs/ghg.toml", configText: 'title = "x"' })), path.join("docs", "site"));
  assert.equal(outputFolderOf(settings({ configFile: "docs/ghg.toml" })), "site");
});
