// Port: a run of ghg, with its output in the step's log.

export interface GhgRun {
  readonly status: number;
  readonly standardOutput: string;
}

export interface GhgProcess {
  /** Runs the program with those arguments, its standard output and standard error both shown in the step's log. */
  run(program: string, commandArguments: readonly string[]): Promise<GhgRun>;
}
