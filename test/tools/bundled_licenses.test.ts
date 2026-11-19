// Tests the licence notices of the bundle, issue #1, decision 15.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  embeddedCodeOf,
  licenseFilesOf,
  licenseFoldersOf,
  licensesText,
  packageFieldsOf,
  packageFoldersOf,
} from "../../tools/bundled_licenses.ts";

test("each package the metafile lists an input of is named once, by its own folder", () => {
  const inputs = [
    "src/main.ts",
    "node_modules/@actions/core/lib/core.js",
    "node_modules/@actions/core/lib/command.js",
    "node_modules/semver/index.js",
    "node_modules/@actions/tool-cache/node_modules/semver/index.js",
  ];
  assert.deepEqual(packageFoldersOf(inputs), [
    "node_modules/@actions/core",
    "node_modules/@actions/tool-cache/node_modules/semver",
    "node_modules/semver",
  ]);
});

test("a licence kept beside bundled code, deep in its package, is looked for too", () => {
  const inputs = [
    "node_modules/undici/index.js",
    "node_modules/undici/lib/web/fetch/body.js",
    "node_modules/undici/lib/web/fetch/index.js",
    "node_modules/tunnel/index.js",
  ];
  assert.deepEqual(licenseFoldersOf("node_modules/undici", inputs), [
    "node_modules/undici",
    "node_modules/undici/lib",
    "node_modules/undici/lib/web",
    "node_modules/undici/lib/web/fetch",
  ]);
});

test("the licence files are found whatever their case and extension, and nothing else is taken for one", () => {
  assert.deepEqual(licenseFilesOf(["package.json", "LICENSE.md", "README.md"]), ["LICENSE.md"]);
  assert.deepEqual(licenseFilesOf(["license", "COPYING.txt", "LICENSE-MIT"]), ["COPYING.txt", "LICENSE-MIT", "license"]);
  assert.deepEqual(licenseFilesOf(["README.md", "licenses.js", "license.js"]), []);
});

test("a package.json gives its name, version and licence, or nothing when one is missing", () => {
  assert.deepEqual(packageFieldsOf({ name: "tunnel", version: "0.0.6", license: "MIT", main: "index.js" }), {
    name: "tunnel",
    version: "0.0.6",
    license: "MIT",
  });
  assert.equal(packageFieldsOf({ name: "tunnel", version: "0.0.6" }), undefined);
  assert.equal(packageFieldsOf(null), undefined);
});

test("llhttp's notice is carried only when undici's copy of it is bundled", () => {
  assert.deepEqual(
    embeddedCodeOf(["node_modules/undici/lib/llhttp/llhttp-wasm.js"]).map((code) => code.noticeFile),
    ["tools/licenses/llhttp.txt"],
  );
  assert.deepEqual(embeddedCodeOf(["node_modules/undici/index.js"]), []);
});

test("the notices name each package, its version and its licence, then its licence files, the embedded code and the comments", () => {
  const text = licensesText(
    [
      { name: "semver", version: "7.8.6", license: "ISC", licenseFiles: [{ path: "node_modules/semver/LICENSE", text: "ISC\n\n" }] },
      {
        name: "undici",
        version: "6.29.1",
        license: "MIT",
        licenseFiles: [
          { path: "node_modules/undici/LICENSE", text: "MIT" },
          { path: "node_modules/undici/lib/web/fetch/LICENSE", text: "MIT, Ethan Arrowood" },
        ],
      },
    ],
    ["llhttp's notice\n"],
    "/*! ws. MIT License. Einar Otto Stangvik */\n",
  );
  assert.equal(
    text,
    "dist/index.cjs bundles these packages, each under the licence that follows its name.\n" +
      "\n\n" +
      "Package semver 7.8.6, under the licence ISC.\n\nFrom node_modules/semver/LICENSE:\n\nISC\n" +
      "\n\n" +
      "Package undici 6.29.1, under the licence MIT.\n\nFrom node_modules/undici/LICENSE:\n\nMIT\n" +
      "\nFrom node_modules/undici/lib/web/fetch/LICENSE:\n\nMIT, Ethan Arrowood\n" +
      "\n\n" +
      "llhttp's notice\n" +
      "\n\n" +
      "Notices in comments of the bundled code:\n\n/*! ws. MIT License. Einar Otto Stangvik */\n",
  );
});

test("no section of comments is written when the bundled code has none", () => {
  assert.doesNotMatch(licensesText([], [], "\n"), /comments/);
});
