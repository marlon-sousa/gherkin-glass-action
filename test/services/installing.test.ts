// Tests docs/BEHAVIOUR.md, rules 1 to 6: installing ghg, through fakes of the ports.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { platformOf, type Platform } from "../../src/policies/targets.ts";
import { installGhg } from "../../src/services/installing.ts";
import { FakeFiles, FakeReleases, FakeRunner, FakeToolCache } from "../support/fakes.ts";

const LINUX = platformOf("Linux", "X64");
const WINDOWS = platformOf("Windows", "X64");
const ARCHIVE = "ghg-v1.2.0-x86_64-unknown-linux-musl.tar.gz";
const SUM = "c".repeat(64);
const STABLE = [
  { tag: "v1.2.0", draft: false, prerelease: false },
  { tag: "v1.3.0-rc.1", draft: false, prerelease: true },
];

function platform(given: Platform | { readonly problem: string }): Platform {
  assert.ok("target" in given);
  return given;
}

function release(files: Record<string, string> = { [ARCHIVE]: "", SHA256SUMS: "" }) {
  return new FakeReleases(STABLE, Object.fromEntries(Object.entries(files).map(([name, text]) => [`v1.2.0/${name}`, text])));
}

function ports(releases = release(), files = sound()) {
  return { runner: new FakeRunner(), releases, toolCache: new FakeToolCache(), files };
}

// The files of a sound release: SHA256SUMS lists the archive, which holds ghg.
function sound(binary = "ghg", sums = `${SUM}  ${ARCHIVE}\n`, sum = SUM) {
  return new FakeFiles(
    { "downloads/v1.2.0/SHA256SUMS": sums, [path.join(`unpacked/downloads/v1.2.0/${ARCHIVE}`, binary)]: "" },
    { [`downloads/v1.2.0/${ARCHIVE}`]: sum },
  );
}

async function stops(install: Promise<unknown>, message: string) {
  await assert.rejects(install, (error) => error instanceof ActionStop && error.message === message);
}

test("ghg is downloaded, checked, kept in the tool cache and put on the PATH", async () => {
  const used = ports();
  const ghg = await installGhg("1.2.0", platform(LINUX), false, 1, used);
  assert.deepEqual(ghg, { program: path.join("cache/1.2.0", "ghg"), version: "1.2.0" });
  assert.deepEqual(used.runner.path, ["cache/1.2.0"]);
  assert.deepEqual(used.runner.logged, ["ghg 1.2.0 is installed."]);
  assert.deepEqual(used.releases.downloads, [`v1.2.0/${ARCHIVE}`, "v1.2.0/SHA256SUMS"]);
});

test("without a version, the newest stable release of the paired major version is installed", async () => {
  const used = ports();
  await installGhg(undefined, platform(LINUX), false, 1, used);
  assert.deepEqual(used.runner.logged, ["ghg 1.2.0 is installed."]);
});

test("without a compatible release, or a listing, the action stops", async () => {
  await stops(installGhg(undefined, platform(LINUX), false, 2, ports()), "ghg has no release compatible with this action's version.");
  await stops(
    installGhg(undefined, platform(LINUX), false, 1, ports(new FakeReleases(undefined))),
    "The releases of ghg cannot be listed.",
  );
});

test("a ghg to build with older than 1.1.0 stops the action before it is downloaded, but may be installed alone", async () => {
  const old = ports(release({ [ARCHIVE.replace("1.2.0", "1.0.0")]: "", SHA256SUMS: "" }));
  await stops(installGhg("1.0.0", platform(LINUX), true, 1, old), "The action builds with ghg 1.1.0 or newer, not 1.0.0.");
  assert.deepEqual(old.releases.downloads, []);
  const building = ports();
  await installGhg("1.2.0", platform(LINUX), true, 1, building);
  assert.deepEqual(building.runner.logged, ["ghg 1.2.0 is installed."]);
});

test("a ghg already in the tool cache is not downloaded again", async () => {
  const used = ports();
  await installGhg("1.2.0", platform(LINUX), false, 1, used);
  await installGhg("1.2.0", platform(LINUX), false, 1, used);
  assert.equal(used.releases.downloads.length, 2);
  assert.equal(used.toolCache.unpacked.length, 1);
  assert.deepEqual(used.runner.path, ["cache/1.2.0", "cache/1.2.0"]);
});

test("Windows installs ghg.exe from the zip", async () => {
  const zip = "ghg-v1.2.0-x86_64-pc-windows-msvc.zip";
  const files = new FakeFiles(
    { "downloads/v1.2.0/SHA256SUMS": `${SUM} *${zip}\n`, [path.join(`unpacked/downloads/v1.2.0/${zip}`, "ghg.exe")]: "" },
    { [`downloads/v1.2.0/${zip}`]: SUM },
  );
  const ghg = await installGhg("1.2.0", platform(WINDOWS), false, 1, ports(release({ [zip]: "", SHA256SUMS: "" }), files));
  assert.equal(ghg.program, path.join("cache/1.2.0", "ghg.exe"));
});

test("a missing archive or SHA256SUMS stops the action", async () => {
  await stops(
    installGhg("1.2.0", platform(LINUX), false, 1, ports(release({ SHA256SUMS: "" }))),
    `${ARCHIVE} cannot be downloaded from the release v1.2.0 of ghg.`,
  );
  await stops(
    installGhg("1.2.0", platform(LINUX), false, 1, ports(release({ [ARCHIVE]: "" }))),
    "SHA256SUMS cannot be downloaded from the release v1.2.0 of ghg.",
  );
});

test("an archive that does not match SHA256SUMS is never installed", async () => {
  const unlisted = ports(release(), sound("ghg", `${SUM}  another.tar.gz\n`));
  await stops(installGhg("1.2.0", platform(LINUX), false, 1, unlisted), `${ARCHIVE} is not in the release's SHA256SUMS.`);
  const differing = ports(release(), sound("ghg", `${SUM}  ${ARCHIVE}\n`, "d".repeat(64)));
  await stops(installGhg("1.2.0", platform(LINUX), false, 1, differing), `${ARCHIVE} does not match its checksum in SHA256SUMS.`);
  assert.deepEqual([unlisted.toolCache.unpacked, differing.toolCache.unpacked], [[], []]);
});

test("an archive without ghg at its root stops the action", async () => {
  await stops(installGhg("1.2.0", platform(LINUX), false, 1, ports(release(), sound("bin/ghg"))), `${ARCHIVE} has no ghg.`);
});
