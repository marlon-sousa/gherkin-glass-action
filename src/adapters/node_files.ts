// Adapter: the runner's files, through Node's file system.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Files } from "../ports/files.ts";

export class NodeFiles implements Files {
  async readText(file: string): Promise<string | undefined> {
    try {
      return await readFile(file, "utf8");
    } catch {
      return undefined;
    }
  }

  async sha256Of(file: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest("hex");
  }

  async writeTemporary(name: string, text: string): Promise<string> {
    const folder = await mkdtemp(path.join(process.env["RUNNER_TEMP"] ?? os.tmpdir(), "ghg-"));
    const file = path.join(folder, name);
    await writeFile(file, text);
    return file;
  }

  async isFile(file: string): Promise<boolean> {
    try {
      return (await stat(file)).isFile();
    } catch {
      return false;
    }
  }
}
