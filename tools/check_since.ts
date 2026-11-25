// Tool: fails when a release of ghg does not have exactly the options ghg-options.json says it has.
// Usage: ghg build --help | node tools/check_since.ts <release>

import { text } from "node:stream/consumers";
import ghgOptions from "../ghg-options.json" with { type: "json" };
import { isOlder } from "../src/policies/versions.ts";
import { optionsOfHelp } from "./help_options.ts";

const release = process.argv[2] ?? "";
const options = optionsOfHelp(await text(process.stdin));
const expected = Object.entries(ghgOptions.since).flatMap(([option, since]) => (isOlder(release, since) ? [] : [option]));
const unexpected = options.filter((option) => !expected.includes(option));
const missing = expected.filter((option) => !options.includes(option));
for (const option of unexpected) console.log(`::error::ghg ${release} has --${option}, which ghg-options.json says comes later.`);
for (const option of missing) console.log(`::error::ghg ${release} has no --${option}, which ghg-options.json says it has.`);
if (release === "") console.log("::error::No release is given.");
const failed = unexpected.length + missing.length > 0 || release === "";
process.exitCode = failed ? 1 : 0;
if (!failed) console.log(`ghg ${release} has the options ghg-options.json says: ${options.join(", ")}.`);
