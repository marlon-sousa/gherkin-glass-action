// Tests rule 5: the checksum SHA256SUMS lists for an archive.

import assert from "node:assert/strict";
import { test } from "node:test";
import { listedChecksum } from "../../src/policies/checksums.ts";

const LINUX = "a".repeat(64);
const WINDOWS = "B".repeat(64);
const SUMS = [
  `${LINUX}  ghg-v1.0.0-x86_64-unknown-linux-musl.tar.gz`,
  `${WINDOWS} *ghg-v1.0.0-x86_64-pc-windows-msvc.zip\r`,
  "not a line of sha256sum",
  "",
].join("\n");

test("the checksum is the one listed for the archive, in lower case", () => {
  assert.equal(listedChecksum(SUMS, "ghg-v1.0.0-x86_64-unknown-linux-musl.tar.gz"), LINUX);
  assert.equal(listedChecksum(SUMS, "ghg-v1.0.0-x86_64-pc-windows-msvc.zip"), WINDOWS.toLowerCase());
});

test("an archive the file does not list has none", () => {
  assert.equal(listedChecksum(SUMS, "ghg-v1.0.0-aarch64-apple-darwin.tar.gz"), undefined);
  assert.equal(listedChecksum(SUMS, "ghg-v1.0.0-x86_64-unknown-linux-musl"), undefined);
  assert.equal(listedChecksum("", "SHA256SUMS"), undefined);
});
