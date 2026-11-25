// Tests rule 9: reading the options of ghg build from its help.

import assert from "node:assert/strict";
import { test } from "node:test";
import { optionsOfHelp } from "../../tools/help_options.ts";

// ghg 1.0.0's help, as ghg build --help prints it.
const HELP = `ghg turns a folder of Gherkin feature files into an accessible website.

Usage: ghg <command> [options]

Commands:
  build: reads the feature files and writes the site, or reports every file that cannot be read.
  serve: builds the site and serves it on this machine, to preview it.

Options of ghg build and ghg serve:
  --config <file>: the configuration file to read, instead of ghg.toml in the current folder.
  --input <folder>: the folder of feature files to read, instead of the configuration's input.
  --output <folder>: the folder to write the site into, instead of the configuration's output.
  --title <text>: the site's title, instead of the configuration's title.
  --version-name <name>: builds the site as the version of that name, instead of the configuration's version_name.
  --front-page <file>: the Markdown template of the site's front page, instead of the configuration's front_page.
  --only <file>: builds the site from the feature files the file lists, one path on each line, alone. --only - reads the list from standard input.
  --preview: builds a preview, a site without versions whose every page asks search engines not to index it.

Options of ghg serve only:
  --host <address>: the address to listen on, instead of 127.0.0.1.
  --port <number>: the port to listen at, instead of 8000. 0 lets the system choose one.
  --no-build: serves the output folder as it is, without building it.
  --watch: rebuilds the site when its files change, and reloads the pages open in a browser.

Other options:
  --help, -h: prints this help.
  --version, -V: prints the version.
`;

test("the options of ghg build are those of its section, in order", () => {
  assert.deepEqual(optionsOfHelp(HELP), [
    "config",
    "input",
    "output",
    "title",
    "version-name",
    "front-page",
    "only",
    "preview",
  ]);
});

test("a section only for ghg build counts too, and a help without one lists none", () => {
  assert.deepEqual(optionsOfHelp("Options of ghg build:\r\n  --watch: watches.\r\nOther options:\r\n  --help"), ["watch"]);
  assert.deepEqual(optionsOfHelp("Usage: ghg <command>\n"), []);
});
