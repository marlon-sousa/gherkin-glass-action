// Tool: fails when the inputs, ghg-options.json and the options of ghg build differ.
// Usage: ghg build --help | node tools/check_inputs.ts

import { text } from "node:stream/consumers";
import ghgOptions from "../ghg-options.json" with { type: "json" };
import { BUILD_OPTIONS } from "../src/policies/build_arguments.ts";
import { optionsOfHelp } from "./help_options.ts";

const options = optionsOfHelp(await text(process.stdin));
const named = Object.keys(ghgOptions.since);
const unnamed = options.filter((option) => !named.includes(option));
const notListed = named.filter((option) => !options.includes(option));
const withoutOption = BUILD_OPTIONS.map((option) => option.name).filter((input) => !named.includes(input));
for (const option of unnamed) console.log(`::error::The option --${option} of ghg build is not in ghg-options.json.`);
for (const option of notListed) console.log(`::error::ghg-options.json names ${option}, which ghg build --help does not list.`);
for (const input of withoutOption) console.log(`::error::The input ${input} is not in ghg-options.json.`);
if (options.length === 0) console.log("::error::ghg build --help lists no option.");
const failed = unnamed.length + notListed.length + withoutOption.length > 0 || options.length === 0;
process.exitCode = failed ? 1 : 0;
if (!failed) console.log(`ghg-options.json and the inputs name every option of ghg build: ${options.join(", ")}.`);
