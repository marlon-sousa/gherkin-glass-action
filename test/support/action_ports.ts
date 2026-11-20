// Test support: the ports of an action, with fakes that hold a release of ghg it installs.

import path from "node:path";
import type { GhgReleases } from "../../src/ports/ghg_releases.ts";
import { FakeFiles, FakeGhgProcess, FakeReleases, FakeToolCache, type FakeRunner } from "./fakes.ts";

const ARCHIVE = "ghg-v1.2.0-x86_64-unknown-linux-musl.tar.gz";
const SUM = "e".repeat(64);

/** The ports of an action on Linux, whose releases hold ghg 1.2.0, and which records the tokens the releases are listed with. */
export function actionPorts(runner: FakeRunner, process = new FakeGhgProcess(), releases: GhgReleases = releasesOf120()) {
  const tokens: (string | undefined)[] = [];
  return {
    tokens,
    runner,
    process,
    toolCache: new FakeToolCache(),
    releasesWith: (token: string | undefined) => {
      tokens.push(token);
      return releases;
    },
    files: new FakeFiles(
      { "downloads/v1.2.0/SHA256SUMS": `${SUM}  ${ARCHIVE}\n`, [path.join(`unpacked/downloads/v1.2.0/${ARCHIVE}`, "ghg")]: "" },
      { [`downloads/v1.2.0/${ARCHIVE}`]: SUM },
    ),
  };
}

function releasesOf120() {
  return new FakeReleases([{ tag: "v1.2.0", draft: false, prerelease: false }], {
    [`v1.2.0/${ARCHIVE}`]: "",
    "v1.2.0/SHA256SUMS": "",
  });
}
