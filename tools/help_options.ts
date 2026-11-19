// Tool: the options of ghg build that ghg build --help lists, for docs/BEHAVIOUR.md, rule 9.

/**
 * The options, without their dashes, listed under "Options of ghg build" as ghg 1.x prints
 * its help: the section whose heading starts so, up to the next heading, one option a line,
 * such as "  --input <folder>: the folder of feature files to read".
 */
export function optionsOfHelp(help: string): readonly string[] {
  const options: string[] = [];
  let inside = false;
  for (const line of help.split(/\r?\n/)) {
    if (/^\S/.test(line)) inside = line.startsWith("Options of ghg build");
    const option = inside ? /^\s+--([a-z][a-z-]*)[\s:]/.exec(line) : null;
    if (option?.[1] !== undefined) options.push(option[1]);
  }
  return options;
}
