// Tool: downloads act and WireMock, which the acceptance tests run, at pinned versions checked against their checksums, into .acceptance/.
// Usage: node tools/acceptance_tools.ts

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ACCEPTANCE_TOOLS, TOOLS_FOLDER as FOLDER } from "../test/acceptance/support/tools.ts";

// The checksums of nektos/act v0.2.97's checksums.txt.
const ACT_VERSION = "0.2.97";
const ACT_ARCHIVES: Readonly<Record<string, { readonly name: string; readonly sha256: string }>> = {
  "linux/x64": { name: "act_Linux_x86_64.tar.gz", sha256: "67b4976a56f33ea7870b798912e738ec44eef38e7578ae7b532f2def1c73a5ad" },
  "linux/arm64": { name: "act_Linux_arm64.tar.gz", sha256: "44d48e3d4a6409053fdec6fc6518322467d79a2d5be8f72c021b0421e2ac113d" },
  "darwin/x64": { name: "act_Darwin_x86_64.tar.gz", sha256: "cba9cf071f69c47b2fef60a4c735002b6cbd416533920406f72eac0cf7ffec3a" },
  "darwin/arm64": { name: "act_Darwin_arm64.tar.gz", sha256: "6dbb1ef34a7e34bb1ee0db188d1682ea35b82d9d9012626497f6c659e55a7cb5" },
  "win32/x64": { name: "act_Windows_x86_64.zip", sha256: "07cb9bbecc5604452dc50e2a485e17e02e38c3735c47ce8adc8ac550ab968a8a" },
  "win32/arm64": { name: "act_Windows_arm64.zip", sha256: "88a5e8620699c97077b95bb1474ad162bb5687406a9cb4c6d7701bf46b585608" },
};

// The SHA-256 of WireMock's standalone jar 3.13.2 on Maven Central, whose SHA-1 is 8bfbad28c85f7b4927694491f2c8030c898c72a9.
const WIREMOCK = {
  address:
    "https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/3.13.2/wiremock-standalone-3.13.2.jar",
  sha256: "d097b19bd483c5038479b13a5c71e9faf8f2f5106584f0c120a7770ab0bdb367",
};

async function download(address: string, sha256: string, file: string): Promise<void> {
  const response = await fetch(address);
  if (!response.ok) throw new Error(`${address} cannot be downloaded: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new Error(`${address} does not match its checksum: ${actual}`);
  writeFileSync(file, bytes);
}

mkdirSync(FOLDER, { recursive: true });
const stamp = path.join(FOLDER, "versions.txt");
const versions = `act ${ACT_VERSION}\nwiremock ${WIREMOCK.sha256}\n`;
if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== versions) {
  const archive = ACT_ARCHIVES[`${process.platform}/${process.arch}`];
  if (archive === undefined) throw new Error(`act has no build for ${process.platform} on ${process.arch}.`);
  const archiveFile = path.join(FOLDER, archive.name);
  await download(`https://github.com/nektos/act/releases/download/v${ACT_VERSION}/${archive.name}`, archive.sha256, archiveFile);
  // Windows' own tar, bsdtar, reads a zip, and Git's GNU tar, ahead of it on Git Bash's PATH, does not.
  const tar = process.platform === "win32" ? path.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  execFileSync(tar, ["-xf", archive.name, path.basename(ACCEPTANCE_TOOLS.act)], { cwd: FOLDER });
  rmSync(archiveFile);
  await download(WIREMOCK.address, WIREMOCK.sha256, ACCEPTANCE_TOOLS.wiremock);
  writeFileSync(stamp, versions);
}
console.log(`act ${ACT_VERSION} and WireMock 3.13.2 are in ${FOLDER}/.`);
