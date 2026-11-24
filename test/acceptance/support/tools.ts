// Test support: where the programs the acceptance tests run are, once tools/acceptance_tools.ts has downloaded them.

import path from "node:path";

/** The folder the tools are downloaded into, in the repository's root. */
export const TOOLS_FOLDER = ".acceptance";

export const ACCEPTANCE_TOOLS = {
  act: path.resolve(TOOLS_FOLDER, process.platform === "win32" ? "act.exe" : "act"),
  wiremock: path.resolve(TOOLS_FOLDER, "wiremock.jar"),
};
