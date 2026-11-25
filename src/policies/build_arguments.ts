// Policy: the arguments of ghg build, from the action's inputs.

export interface BuildOption {
  readonly name: string;
  readonly takes: "nothing" | "value" | "lines";
}

/** In the order ghg build --help lists them. */
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

export const ACTION_OPTIONS: readonly string[] = ["message-format"];

export const OWN_INPUTS: readonly string[] = ["ghg-version", "build", "token"];

/** Or the sentence the action stops with. */
export function buildAsked(input: string): boolean | { readonly problem: string } {
  return trueOrFalse("build", input);
}

/** The arguments after build itself, or the sentence the action stops with for a flag that is neither true nor false. */
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

/** Without the lines that are empty or of white space only. */
export function linesOf(input: string): readonly string[] {
  return input.split(/\r?\n/).filter((line) => line.trim() !== "");
}
