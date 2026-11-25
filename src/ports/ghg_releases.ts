// Port: the releases of ghg on GitHub, and the files they hold.

import type { ReleaseListing } from "../policies/versions.ts";

export interface GhgReleases {
  /** Every release of ghg, drafts and pre-releases included, or undefined when they cannot be listed. */
  listReleases(): Promise<readonly ReleaseListing[] | undefined>;
  /** Downloads a file of the release of that version, returning its local path, or undefined when it cannot be. */
  downloadFile(version: string, fileName: string): Promise<string | undefined>;
}
