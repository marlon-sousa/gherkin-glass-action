// Policy: where the files ghg build reports are, found as ghg finds them, for docs/BEHAVIOUR.md, rule 10.

import path from "node:path";
import { parse } from "smol-toml";

/** Where ghg build's settings come from: its inputs, and the configuration file it reads. */
export interface BuildSettings {
  /** The input input, empty when it is not given. */
  readonly input: string;
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
  const configured = settings.configText === undefined ? {} : configuredPaths(settings.configText);
  const besideConfig = (key: string) => (path.isAbsolute(key) ? key : path.join(path.dirname(settings.configFile), key));
  const inputFolder =
    settings.input !== ""
      ? settings.input
      : settings.configText === undefined
        ? "features"
        : besideConfig(configured.input ?? "features");
  const frontPage =
    settings.frontPage !== "" ? settings.frontPage : configured.frontPage && besideConfig(configured.frontPage);
  return {
    inputFolder,
    workspaceFiles: [settings.configFile, ...(frontPage ? [frontPage] : [])].map((file) => path.normalize(file)),
  };
}

// The keys that take a path. A file ghg cannot read reports its own problem, and the action
// then annotates with the defaults.
function configuredPaths(configText: string): { readonly input?: string; readonly frontPage?: string } {
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
