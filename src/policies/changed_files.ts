// Policy: the files of a pull request that its preview shows, as docs/BEHAVIOUR.md, rule 26, says.

import path from "node:path";

/** A file a pull request changes, by its path from the repository's root, and whether it removes it. */
export interface ChangedFile {
  readonly path: string;
  readonly removed: boolean;
}

/**
 * The files the pull request changes and does not remove that are inside the input folder,
 * by their paths from the workspace, which is the repository's root. ghg tells which of them
 * are feature files it reads (gherkin-glass's rule 205).
 */
export function filesToPreview(changed: readonly ChangedFile[], inputFolder: string, workspace: string): string[] {
  const folder = path.resolve(workspace, inputFolder);
  return changed
    .filter((file) => !file.removed)
    .map((file) => file.path)
    .filter((file) => {
      const below = path.relative(folder, path.resolve(workspace, file));
      return below !== "" && !below.startsWith("..") && !path.isAbsolute(below);
    });
}
