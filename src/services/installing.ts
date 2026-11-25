// Service: installs ghg on the runner.

import path from "node:path";
import { ActionStop } from "../action_stop.ts";
import { listedChecksum } from "../policies/checksums.ts";
import { archiveName, type Platform } from "../policies/targets.ts";
import { tooOldFor, type GhgOptions, type OptionsPassed } from "../policies/ghg_options.ts";
import { majorOf, newestStable } from "../policies/versions.ts";
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

export interface InstalledGhg {
  readonly program: string;
  readonly version: string;
}

/** Puts ghg's folder on the PATH; a version without an option passed stops the action before anything is downloaded. */
export async function installGhg(
  version: string | undefined,
  platform: Platform,
  /** Undefined when the action does not build. */
  passed: OptionsPassed | undefined,
  options: GhgOptions,
  ports: InstallingPorts,
): Promise<InstalledGhg> {
  const installedVersion = version ?? (await newestCompatible(majorOf(options.tested), ports.releases));
  const [tooOld, ...alsoTooOld] = passed === undefined ? [] : tooOldFor(installedVersion, passed, options);
  if (tooOld !== undefined) throw new ActionStop(tooOld, ...alsoTooOld);
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
