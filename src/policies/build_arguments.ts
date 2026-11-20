// Policy: the arguments of ghg build, from the action's inputs, as docs/BEHAVIOUR.md, rules 7 and 8, say.

/** An option of ghg build, by the name its input shares, and whether it takes a value. */
export interface BuildOption {
  readonly name: string;
  readonly takesValue: boolean;
}

/** Every option of ghg build that sets how a site is built, in the order ghg build --help lists them. */
export const BUILD_OPTIONS: readonly BuildOption[] = [
  { name: "config", takesValue: true },
  { name: "input", takesValue: true },
  { name: "output", takesValue: true },
  { name: "title", takesValue: true },
  { name: "version-name", takesValue: true },
  { name: "front-page", takesValue: true },
  { name: "only", takesValue: true },
  { name: "preview", takesValue: false },
];

/** The inputs that are not options of ghg build. */
export const OWN_INPUTS: readonly string[] = ["ghg-version", "build", "token", "publish", "publish-branch", "publish-folder", "changed-only"];

/** Whether the input build asks for a build, or the sentence the action stops with. */
export function buildAsked(input: string): boolean | { readonly problem: string } {
  return trueOrFalse("build", input);
}

/**
 * The arguments ghg build is given, after build itself: each input that is not empty as
 * --<name>=<value>, and a flag as --<name> when it is true; or the sentence the action stops
 * with for a flag that is neither true nor false.
 */
export function buildArguments(
  inputOf: (name: string) => string,
): readonly string[] | { readonly problem: string } {
  const passed: string[] = [];
  for (const option of BUILD_OPTIONS) {
    const value = inputOf(option.name);
    if (option.takesValue) {
      if (value !== "") passed.push(`--${option.name}=${value}`);
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
