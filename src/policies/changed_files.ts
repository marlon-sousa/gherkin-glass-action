// Policy: which files a pull request changes matter to its preview, as docs/BEHAVIOUR.md, rules 28 and 29, say.

import path from "node:path";
import type { ReportPaths } from "./report_paths.ts";

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
  return changed
    .filter((file) => !file.removed && isInside(file.path, inputFolder, workspace))
    .map((file) => file.path);
}

/**
 * Whether a file the commits change, removed or not, is one the preview is built from: inside
 * the input folder, or the configuration file or the front page's Markdown file.
 */
export function changesPreviewSources(changed: readonly ChangedFile[], paths: ReportPaths, workspace: string): boolean {
  const sources = new Set(paths.workspaceFiles.map((file) => path.resolve(workspace, file)));
  return changed.some((file) => sources.has(path.resolve(workspace, file.path)) || isInside(file.path, paths.inputFolder, workspace));
}

function isInside(file: string, folder: string, workspace: string): boolean {
  const below = path.relative(path.resolve(workspace, folder), path.resolve(workspace, file));
  return below !== "" && !below.startsWith("..") && !path.isAbsolute(below);
}
