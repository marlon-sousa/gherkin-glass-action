// Port: the files of the runner the action reads, and the ones it writes for ghg.

export interface Files {
  /** The file's text, or undefined when there is no such file. */
  readText(file: string): Promise<string | undefined>;
  /** The file's SHA-256, in lower-case hexadecimal. */
  sha256Of(file: string): Promise<string>;
  isFile(file: string): Promise<boolean>;
  /** Writes the text into a new file of the runner's temporary folder, and returns the file. */
  writeTemporary(name: string, text: string): Promise<string>;
}
