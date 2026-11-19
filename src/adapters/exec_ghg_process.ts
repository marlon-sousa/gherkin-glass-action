// Adapter: runs ghg through @actions/exec, which shows its output in the step's log.

import { StringDecoder } from "node:string_decoder";
import { exec } from "@actions/exec";
import type { GhgProcess } from "../ports/ghg_process.ts";

export class ExecGhgProcess implements GhgProcess {
  // Standard error is split into lines here, not by the errline listener: @actions/exec
  // gives errline only text that ends in os.EOL, which is \r\n on Windows, and emits what
  // is left at the end on its ToolRunner, which exec() does not listen to (lib/toolrunner.js,
  // lines 75 to 86 and 443 to 449, at 3.0.0). ghg ends its lines with \n on every system.
  async run(program: string, commandArguments: readonly string[], onErrorLine: (line: string) => void): Promise<number> {
    // A character may be cut between two chunks, which the decoder joins again.
    const decoder = new StringDecoder("utf8");
    let unfinished = "";
    const giveLines = (text: string) => {
      const lines = (unfinished + text).split(/\r?\n/);
      unfinished = lines.pop() ?? "";
      lines.filter((line) => line !== "").forEach(onErrorLine);
    };
    const status = await exec(program, [...commandArguments], {
      ignoreReturnCode: true,
      listeners: { stderr: (data: Buffer) => giveLines(decoder.write(data)) },
    });
    giveLines(decoder.end());
    if (unfinished !== "") onErrorLine(unfinished);
    return status;
  }
}
