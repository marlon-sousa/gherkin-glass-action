// Port: the files of the runner the action reads.

export interface Files {
  /** The file's text, or undefined when there is no such file. */
  readText(file: string): Promise<string | undefined>;
  /** The file's SHA-256, in lower-case hexadecimal. */
  sha256Of(file: string): Promise<string>;
  /** Whether there is a file there. */
  isFile(file: string): Promise<boolean>;
}
