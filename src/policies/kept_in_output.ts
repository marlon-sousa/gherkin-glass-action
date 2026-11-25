// Policy: what the publish and preview actions keep in the output folder.

import { parse } from "smol-toml";
import { linesOf } from "./build_arguments.ts";

// The files Pages reads at the root of the folder it serves.
const PAGES_FILES = ["/.nojekyll", "/CNAME"];

/** The configuration file's patterns are passed only when the input gives none. */
export function keptInOutputArguments(keepInOutput: string, configText: string | undefined): readonly string[] {
  const given = linesOf(keepInOutput);
  const patterns = given.length > 0 ? given : configuredPatterns(configText);
  return [...PAGES_FILES, ...patterns].map((pattern) => `--keep-in-output=${pattern}`);
}

// None from a file or a key ghg reports as a problem itself.
function configuredPatterns(configText: string | undefined): readonly string[] {
  if (configText === undefined) return [];
  try {
    const { keep_in_output: patterns } = parse(configText);
    // An empty pattern on the command line would stop the build.
    const texts = Array.isArray(patterns) && patterns.every((pattern) => typeof pattern === "string");
    return texts ? patterns.filter((pattern) => pattern !== "") : [];
  } catch {
    return [];
  }
}
