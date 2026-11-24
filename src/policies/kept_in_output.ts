// Policy: what the publish and preview actions keep in the output folder, as docs/BEHAVIOUR.md, rule 19, says.

import { parse } from "smol-toml";
import { linesOf } from "./build_arguments.ts";

// The files Pages reads at the root of the folder it serves: .nojekyll, which turns Jekyll off
// (rule 21), and CNAME, which names a custom domain.
const PAGES_FILES = ["/.nojekyll", "/CNAME"];

/**
 * The --keep-in-output arguments of a site's build: the files Pages reads, then the patterns of
 * the input keep-in-output, or, when it is empty, those of the configuration file's
 * keep_in_output, which ghg reads only when the command line gives none (gherkin-glass's rule 224).
 */
export function keptInOutputArguments(keepInOutput: string, configText: string | undefined): readonly string[] {
  const given = linesOf(keepInOutput);
  const patterns = given.length > 0 ? given : configuredPatterns(configText);
  return [...PAGES_FILES, ...patterns].map((pattern) => `--keep-in-output=${pattern}`);
}

// The key's patterns. A file ghg cannot read, or a key that is not a list of text, reports its
// own problem when ghg reads the file, so the action passes none of it. A pattern that is not
// valid becomes a mistake on the command line instead, as rule 19 says.
function configuredPatterns(configText: string | undefined): readonly string[] {
  if (configText === undefined) return [];
  try {
    const { keep_in_output: patterns } = parse(configText);
    // An empty pattern would be a mistake on the command line rather than the file's problem.
    const texts = Array.isArray(patterns) && patterns.every((pattern) => typeof pattern === "string");
    return texts ? patterns.filter((pattern) => pattern !== "") : [];
  } catch {
    return [];
  }
}
