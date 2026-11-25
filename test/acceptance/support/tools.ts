// Test support: where the programs the acceptance tests run are, once downloaded.

import path from "node:path";

export const TOOLS_FOLDER = ".acceptance";

export const ACCEPTANCE_TOOLS = {
  act: path.resolve(TOOLS_FOLDER, process.platform === "win32" ? "act.exe" : "act"),
  wiremock: path.resolve(TOOLS_FOLDER, "wiremock.jar"),
};
