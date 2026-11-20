// Adapter: the runner's tool cache, through @actions/tool-cache, which keeps ghg under ghg/<version>/<processor>.

import * as toolCache from "@actions/tool-cache";
import type { GhgToolCache } from "../ports/ghg_tool_cache.ts";

export class ActionsToolCache implements GhgToolCache {
  find(version: string): string | undefined {
    return toolCache.find("ghg", version) || undefined;
  }

  unpack(archive: string, packing: "tar.gz" | "zip"): Promise<string> {
    return packing === "zip" ? toolCache.extractZip(archive) : toolCache.extractTar(archive);
  }

  keep(folder: string, version: string): Promise<string> {
    return toolCache.cacheDir(folder, "ghg", version);
  }
}
