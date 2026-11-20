// Policy: where the files ghg build reads and writes are, found as ghg finds them, for docs/BEHAVIOUR.md, rules 10 and 18.

import path from "node:path";
import { parse } from "smol-toml";

/** Where ghg build's settings come from: its inputs, and the configuration file it reads. */
export interface BuildSettings {
  /** The input input, empty when it is not given. */
  readonly input: string;
  /** The input output, empty when it is not given. */
  readonly output: string;
  /** The input front-page, empty when it is not given. */
  readonly frontPage: string;
  /** The configuration file, as ghg build is given it or as it reads it by default. */
  readonly configFile: string;
  /** The configuration file's text, undefined when there is none. */
  readonly configText: string | undefined;
}

/** Where the paths of ghg build's report are relative to. */
export interface ReportPaths {
  /** The input folder, which a feature file's path is relative to. */
  readonly inputFolder: string;
  /** The files ghg names by their path from the workspace: the configuration file and the front page. */
  readonly workspaceFiles: readonly string[];
}

/** The configuration file ghg build reads: the input config, or ghg.toml in the workspace. */
export function configFileOf(configInput: string): string {
  return configInput === "" ? "ghg.toml" : configInput;
}

/**
 * The paths of the report. A setting the inputs give wins over the configuration file's
 * key, whose path is relative to the file's folder, as gherkin-glass's rules 24 and 183
 * say; without either, the input folder is features, beside the file or in the workspace.
 */
export function reportPathsOf(settings: BuildSettings): ReportPaths {
  const configured = configuredPaths(settings.configText);
  const besideConfig = besideConfigOf(settings.configFile);
  const inputFolder = folderOf(settings.input, configured.input, "features", settings);
  const frontPage =
    settings.frontPage !== "" ? settings.frontPage : configured.frontPage && besideConfig(configured.frontPage);
  return {
    inputFolder,
    workspaceFiles: [settings.configFile, ...(frontPage ? [frontPage] : [])].map((file) => path.normalize(file)),
  };
}

/** The output folder ghg build writes the site into, found as the input folder is. */
export function outputFolderOf(settings: BuildSettings): string {
  return folderOf(settings.output, configuredPaths(settings.configText).output, "site", settings);
}

// The folder an input gives; else the configuration file's key, or its default, relative to the
// file's folder; without a file, the default relative to the workspace.
function folderOf(given: string, key: string | undefined, fallback: string, settings: BuildSettings): string {
  if (given !== "") return given;
  return settings.configText === undefined ? fallback : besideConfigOf(settings.configFile)(key ?? fallback);
}

function besideConfigOf(configFile: string): (key: string) => string {
  return (key) => (path.isAbsolute(key) ? key : path.join(path.dirname(configFile), key));
}

// The keys that take a path. A file ghg cannot read reports its own problem, and the action
// then annotates with the defaults.
function configuredPaths(configText: string | undefined): {
  readonly input?: string;
  readonly output?: string;
  readonly frontPage?: string;
} {
  if (configText === undefined) return {};
  try {
    const { input, output, front_page: frontPage } = parse(configText);
    return {
      ...(typeof input === "string" && { input }),
      ...(typeof output === "string" && { output }),
      ...(typeof frontPage === "string" && { frontPage }),
    };
  } catch {
    return {};
  }
}
