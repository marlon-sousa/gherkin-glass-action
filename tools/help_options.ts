// Tool: the options of ghg build that ghg build --help lists.

/** ghg 1.0.0 and 1.1.0 list them under a heading that starts "Options of ghg build", one a line, such as "  --input <folder>: the folder of feature files to read". */
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
