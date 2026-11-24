// Service: installs ghg on the runner, as docs/BEHAVIOUR.md, "Installing", says.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import { listedChecksum } from "../policies/checksums.ts";
import { archiveName, type Platform } from "../policies/targets.ts";
import { buildingProblem, newestStable } from "../policies/versions.ts";
import type { Files } from "../ports/files.ts";
import type { GhgReleases } from "../ports/ghg_releases.ts";
import type { GhgToolCache } from "../ports/ghg_tool_cache.ts";
import type { Runner } from "../ports/runner.ts";

export interface InstallingPorts {
  readonly runner: Runner;
  readonly releases: GhgReleases;
  readonly toolCache: GhgToolCache;
  readonly files: Files;
}

/** A ghg on the runner: its program's path, and its version. */
export interface InstalledGhg {
  readonly program: string;
  readonly version: string;
}

/**
 * Installs ghg and puts its folder on the PATH, returning the ghg installed; a ghg to build with
 * must be one whose report the action reads (rule 2), which is checked before it is downloaded.
 */
export async function installGhg(
  version: string | undefined,
  platform: Platform,
  building: boolean,
  pairedMajor: number,
  ports: InstallingPorts,
): Promise<InstalledGhg> {
  const installedVersion = version ?? (await newestCompatible(pairedMajor, ports.releases));
  const tooOld = building ? buildingProblem(installedVersion) : undefined;
  if (tooOld !== undefined) throw new ActionStop(tooOld.problem);
  const folder =
    ports.toolCache.find(installedVersion) ?? (await downloadGhg(installedVersion, platform, ports));
  ports.runner.addToPath(folder);
  ports.runner.log(`ghg ${installedVersion} is installed.`);
  return { program: path.join(folder, platform.binary), version: installedVersion };
}

async function newestCompatible(major: number, releases: GhgReleases): Promise<string> {
  const listed = await releases.listReleases();
  if (listed === undefined) throw new ActionStop("The releases of ghg cannot be listed.");
  const newest = newestStable(listed, major);
  if (newest === undefined) throw new ActionStop("ghg has no release compatible with this action's version.");
  return newest;
}

// Downloads the archive, checks it against SHA256SUMS, and keeps what it holds in the tool cache.
async function downloadGhg(version: string, platform: Platform, ports: InstallingPorts): Promise<string> {
  const archive = archiveName(version, platform);
  const archiveFile = await downloadOrStop(version, archive, ports.releases);
  const sumsFile = await downloadOrStop(version, "SHA256SUMS", ports.releases);
  const expected = listedChecksum((await ports.files.readText(sumsFile)) ?? "", archive);
  if (expected === undefined) throw new ActionStop(`${archive} is not in the release's SHA256SUMS.`);
  if ((await ports.files.sha256Of(archiveFile)) !== expected) {
    throw new ActionStop(`${archive} does not match its checksum in SHA256SUMS.`);
  }
  const unpacked = await ports.toolCache.unpack(archiveFile, platform.packing);
  if (!(await ports.files.isFile(path.join(unpacked, platform.binary)))) {
    throw new ActionStop(`${archive} has no ghg.`);
  }
  return ports.toolCache.keep(unpacked, version);
}

async function downloadOrStop(version: string, fileName: string, releases: GhgReleases): Promise<string> {
  const file = await releases.downloadFile(version, fileName);
  if (file === undefined) {
    throw new ActionStop(`${fileName} cannot be downloaded from the release v${version} of ghg.`);
  }
  return file;
}
