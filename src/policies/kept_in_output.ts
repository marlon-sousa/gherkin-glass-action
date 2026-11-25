// Policy: what the publish and preview actions keep in the output folder.

import { parse } from "smol-toml";
import { linesOf } from "./build_arguments.ts";

// The files Pages reads at the root of the folder it serves.
const PAGES_FILES = ["/.nojekyll", "/CNAME"];

/** The configuration file's patterns are passed when the input gives none, since ghg reads the key only when the command line gives no pattern. */
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
    const texts = Array.isArray(patterns) && patterns.every((pattern) => typeof pattern === "string");
    return texts ? patterns.filter((pattern) => pattern !== "") : [];
  } catch {
    return [];
  }
}
