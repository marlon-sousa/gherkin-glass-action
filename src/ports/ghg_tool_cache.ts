// Port: the runner's tool cache, where an installed ghg is kept by version and processor.

export interface GhgToolCache {
  /** The folder of that version of ghg in the cache, if it is there. */
  find(version: string): string | undefined;
  unpack(archive: string, packing: "tar.gz" | "zip"): Promise<string>;
  /** Keeps a folder in the cache as that version of ghg, returning the folder in the cache. */
  keep(folder: string, version: string): Promise<string>;
}
