// Policy: the arguments of ghg build, from the action's inputs, as docs/BEHAVIOUR.md, rules 7 and 8, say.

/** An option of ghg build, by the name its input shares, and whether it takes a value, or one on each line of its input. */
export interface BuildOption {
  readonly name: string;
  readonly takes: "nothing" | "value" | "lines";
}

/** Every option of ghg build that sets how a site is built, in the order ghg build --help lists them. */
export const BUILD_OPTIONS: readonly BuildOption[] = [
  { name: "config", takes: "value" },
  { name: "input", takes: "value" },
  { name: "output", takes: "value" },
  { name: "title", takes: "value" },
  { name: "version-name", takes: "value" },
  { name: "front-page", takes: "value" },
  { name: "only", takes: "value" },
  { name: "preview", takes: "nothing" },
  { name: "keep-in-output", takes: "lines" },
];

/** The options of ghg build the action gives itself, which have no input (rule 7). */
export const ACTION_OPTIONS: readonly string[] = ["message-format"];

/** The inputs that are not options of ghg build. */
export const OWN_INPUTS: readonly string[] = ["ghg-version", "build", "token"];

/** Whether the input build asks for a build, or the sentence the action stops with. */
export function buildAsked(input: string): boolean | { readonly problem: string } {
  return trueOrFalse("build", input);
}

/**
 * The arguments ghg build is given, after build itself: each input that is not empty as
 * --<name>=<value>, an option given more than once once for each line, and a flag as --<name>
 * when it is true; or the sentence the action stops with for a flag that is neither true nor false.
 */
export function buildArguments(
  inputOf: (name: string) => string,
): readonly string[] | { readonly problem: string } {
  const passed: string[] = [];
  for (const option of BUILD_OPTIONS) {
    const value = inputOf(option.name);
    if (option.takes === "value") {
      if (value !== "") passed.push(`--${option.name}=${value}`);
      continue;
    }
    if (option.takes === "lines") {
      passed.push(...linesOf(value).map((line) => `--${option.name}=${line}`));
      continue;
    }
    const given = trueOrFalse(option.name, value);
    if (typeof given !== "boolean") return given;
    if (given) passed.push(`--${option.name}`);
  }
  return passed;
}

function trueOrFalse(name: string, input: string): boolean | { readonly problem: string } {
  if (input === "true") return true;
  if (input === "false" || input === "") return false;
  return { problem: `${name} must be true or false.` };
}

/** The lines of a multi-line input, without those that are empty or of white space only. */
export function linesOf(input: string): readonly string[] {
  return input.split(/\r?\n/).filter((line) => line.trim() !== "");
}
