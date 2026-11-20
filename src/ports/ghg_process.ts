// Port: a run of ghg, with its output in the step's log.

export interface GhgProcess {
  /** Runs the program with those arguments, giving each line of its standard error, and returns its exit status. */
  run(program: string, commandArguments: readonly string[], onErrorLine: (line: string) => void): Promise<number>;
}
