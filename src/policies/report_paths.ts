// Policy: where the files ghg build reads are, found as ghg finds them.

import path from "node:path";
import { parse } from "smol-toml";

export interface BuildSettings {
  /** Empty when the input is not given. */
  readonly input: string;
  /** Empty when the input is not given. */
  readonly frontPage: string;
  readonly configFile: string;
  /** Undefined when there is no configuration file. */
  readonly configText: string | undefined;
}

export interface ReportPaths {
  readonly inputFolder: string;
  /** The configuration file and the front page, which the report names from the workspace. */
  readonly workspaceFiles: readonly string[];
}

export function configFileOf(configInput: string): string {
  return configInput === "" ? "ghg.toml" : configInput;
}

/** An input wins over the configuration file's key, whose path is relative to the file's folder. */
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

function folderOf(given: string, key: string | undefined, fallback: string, settings: BuildSettings): string {
  if (given !== "") return given;
  return settings.configText === undefined ? fallback : besideConfigOf(settings.configFile)(key ?? fallback);
}

function besideConfigOf(configFile: string): (key: string) => string {
  return (key) => (path.isAbsolute(key) ? key : path.join(path.dirname(configFile), key));
}

// Empty for a file ghg reports as a problem itself.
function configuredPaths(configText: string | undefined): {
  readonly input?: string;
  readonly frontPage?: string;
} {
  if (configText === undefined) return {};
  try {
    const { input, front_page: frontPage } = parse(configText);
    return {
      ...(typeof input === "string" && { input }),
      ...(typeof frontPage === "string" && { frontPage }),
    };
  } catch {
    return {};
  }
}
