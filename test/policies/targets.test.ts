// Tests rule 4: the archive of each runner's system and processor.

import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveName, platformOf } from "../../src/policies/targets.ts";

test("each platform ghg is built for installs its target's archive", () => {
  const archives = [
    ["Linux", "X64", "ghg-v1.2.0-x86_64-unknown-linux-musl.tar.gz"],
    ["Linux", "ARM64", "ghg-v1.2.0-aarch64-unknown-linux-musl.tar.gz"],
    ["macOS", "X64", "ghg-v1.2.0-x86_64-apple-darwin.tar.gz"],
    ["macOS", "ARM64", "ghg-v1.2.0-aarch64-apple-darwin.tar.gz"],
    ["Windows", "X64", "ghg-v1.2.0-x86_64-pc-windows-msvc.zip"],
    ["Windows", "ARM64", "ghg-v1.2.0-aarch64-pc-windows-msvc.zip"],
  ];
  for (const [system = "", processor = "", archive] of archives) {
    const platform = platformOf(system, processor);
    assert.ok("target" in platform, `${system} on ${processor}`);
    assert.equal(archiveName("1.2.0", platform), archive);
  }
});

test("only Windows installs ghg.exe", () => {
  assert.deepEqual(platformOf("Windows", "X64"), {
    target: "x86_64-pc-windows-msvc",
    packing: "zip",
    binary: "ghg.exe",
  });
  assert.deepEqual(platformOf("Linux", "ARM64"), {
    target: "aarch64-unknown-linux-musl",
    packing: "tar.gz",
    binary: "ghg",
  });
});

test("a platform without a build is named in the runner's words", () => {
  assert.deepEqual(platformOf("Linux", "ARM"), { problem: "ghg has no build for Linux on ARM." });
  assert.deepEqual(platformOf("Linux", "X86"), { problem: "ghg has no build for Linux on X86." });
  assert.deepEqual(platformOf("", ""), { problem: "ghg has no build for this system on this processor." });
});
