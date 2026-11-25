// Adapter: runs ghg through @actions/exec, which shows its output in the step's log.

import { StringDecoder } from "node:string_decoder";
import { exec } from "@actions/exec";
import type { GhgProcess, GhgRun } from "../ports/ghg_process.ts";

export class ExecGhgProcess implements GhgProcess {
  async run(program: string, commandArguments: readonly string[]): Promise<GhgRun> {
    // A character may be cut between two chunks, which the decoder joins again.
    const decoder = new StringDecoder("utf8");
    let standardOutput = "";
    // @actions/exec 3.0.0 gives the listener every chunk and still writes both streams, and the command line alone, to the log.
    const status = await exec(program, [...commandArguments], {
      ignoreReturnCode: true,
      listeners: { stdout: (data: Buffer) => (standardOutput += decoder.write(data)) },
    });
    return { status, standardOutput: standardOutput + decoder.end() };
  }
}
