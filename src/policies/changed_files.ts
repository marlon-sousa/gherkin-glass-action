// Policy: which files a pull request changes matter to its preview.

import path from "node:path";
import type { ReportPaths } from "./report_paths.ts";

/** path is from the repository's root. */
export interface ChangedFile {
  readonly path: string;
  readonly removed: boolean;
}

/** The files changed and not removed inside the input folder, feature files or not, by their paths from the workspace. */
export function filesToPreview(changed: readonly ChangedFile[], inputFolder: string, workspace: string): string[] {
  return changed
    .filter((file) => !file.removed && isInside(file.path, inputFolder, workspace))
    .map((file) => file.path);
}

/** Whether a changed file, removed or not, is inside the input folder, or is the configuration file or the front page. */
export function changesPreviewSources(changed: readonly ChangedFile[], paths: ReportPaths, workspace: string): boolean {
  const sources = new Set(paths.workspaceFiles.map((file) => path.resolve(workspace, file)));
  return changed.some((file) => sources.has(path.resolve(workspace, file.path)) || isInside(file.path, paths.inputFolder, workspace));
}

function isInside(file: string, folder: string, workspace: string): boolean {
  const below = path.relative(path.resolve(workspace, folder), path.resolve(workspace, file));
  return below !== "" && !below.startsWith("..") && !path.isAbsolute(below);
}
