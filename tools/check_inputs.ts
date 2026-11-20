// Tool: fails when the inputs and the options of ghg build differ, as docs/BEHAVIOUR.md, rule 9, says.
// Usage: ghg build --help | node tools/check_inputs.ts

import { text } from "node:stream/consumers";
import { BUILD_OPTIONS } from "../src/policies/build_arguments.ts";
import { optionsOfHelp } from "./help_options.ts";

const options = optionsOfHelp(await text(process.stdin));
const inputs = BUILD_OPTIONS.map((option) => option.name);
const withoutInput = options.filter((option) => !inputs.includes(option));
const withoutOption = inputs.filter((input) => !options.includes(input));
for (const option of withoutInput) console.log(`::error::The option --${option} of ghg build has no input.`);
for (const input of withoutOption) console.log(`::error::The input ${input} is no option of ghg build.`);
if (options.length === 0) console.log("::error::ghg build --help lists no option.");
process.exitCode = withoutInput.length + withoutOption.length > 0 || options.length === 0 ? 1 : 0;
if (process.exitCode === 0) console.log(`Every option of ghg build has its input: ${options.join(", ")}.`);
