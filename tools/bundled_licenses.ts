// Tool: the licence notices of the packages bundled into dist/index.cjs, which their licences ask to go with every copy (issue #1, decision 15).

import { posix } from "node:path";

/** A licence file of a bundled package: its path from the repository, and its text. */
export interface LicenseFile {
  readonly path: string;
  readonly text: string;
}

/** A package the bundle holds, with the licence its package.json names and the licence files of the folders bundled from it. */
export interface BundledPackage {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly licenseFiles: readonly LicenseFile[];
}

/** What a package's package.json says of it, when it says all of it. */
export type PackageFields = Pick<BundledPackage, "name" | "version" | "license">;

/**
 * Code a package embeds without a licence file in its npm package, whose notice is kept in
 * tools/licenses/. It names the package's version, since another version may embed another release.
 */
export interface EmbeddedCode {
  readonly inputFolder: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly noticeFile: string;
}

/** undici bundles llhttp's WebAssembly, whose MIT licence its npm package does not carry. */
const EMBEDDED_CODE: readonly EmbeddedCode[] = [
  {
    inputFolder: "node_modules/undici/lib/llhttp/",
    packageName: "undici",
    packageVersion: "6.29.1",
    noticeFile: "tools/licenses/llhttp.txt",
  },
];

const LICENSE_FILE = /^(licen[cs]e|copying)(-[a-z0-9]+)?(\.(md|txt))?$/i;

/** The folder of the package an input of esbuild's metafile comes from, such as `node_modules/@actions/core`, the innermost when packages nest. */
function packageFolderOf(inputPath: string): string | undefined {
  return /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(inputPath)?.[1];
}

/** The folder of each package that esbuild's metafile lists an input of, once each and sorted. */
export function packageFoldersOf(inputPaths: readonly string[]): string[] {
  const folders = inputPaths.map(packageFolderOf).filter((folder) => folder !== undefined);
  return [...new Set(folders)].sort();
}

/**
 * The folders that may hold a licence for the bundled inputs of a package: its own folder, and every
 * folder between it and an input, since a package may keep the licence of code it took from another
 * beside that code, as undici keeps `lib/web/fetch/LICENSE`.
 */
export function licenseFoldersOf(packageFolder: string, inputPaths: readonly string[]): string[] {
  const folders = new Set<string>([packageFolder]);
  for (const inputPath of inputPaths) {
    if (packageFolderOf(inputPath) !== packageFolder) continue;
    for (let folder = posix.dirname(inputPath); folder.startsWith(`${packageFolder}/`); folder = posix.dirname(folder)) {
      folders.add(folder);
    }
  }
  return [...folders].sort();
}

/** The licence files among a folder's files, sorted. */
export function licenseFilesOf(fileNames: readonly string[]): string[] {
  return fileNames.filter((fileName) => LICENSE_FILE.test(fileName)).sort();
}

/** The name, version and licence a parsed package.json gives, or undefined when one is missing. */
export function packageFieldsOf(packageJson: unknown): PackageFields | undefined {
  if (typeof packageJson !== "object" || packageJson === null) return undefined;
  if (!("name" in packageJson && "version" in packageJson && "license" in packageJson)) return undefined;
  const { name, version, license } = packageJson;
  if (typeof name !== "string" || typeof version !== "string" || typeof license !== "string") return undefined;
  return { name, version, license };
}

/** The embedded code that the bundled inputs include. */
export function embeddedCodeOf(inputPaths: readonly string[]): EmbeddedCode[] {
  return EMBEDDED_CODE.filter((code) => inputPaths.some((inputPath) => inputPath.startsWith(code.inputFolder)));
}

/**
 * dist/licenses.txt: each package's name, version and licence, then its licence files; then the notices
 * of code embedded without a licence file; then the notices esbuild found in comments of the bundled code.
 */
export function licensesText(
  bundledPackages: readonly BundledPackage[],
  embeddedNotices: readonly string[],
  legalComments: string,
): string {
  const packageSections = bundledPackages.map((bundledPackage) =>
    [
      `Package ${bundledPackage.name} ${bundledPackage.version}, under the licence ${bundledPackage.license}.\n`,
      ...bundledPackage.licenseFiles.map((licenseFile) => `From ${licenseFile.path}:\n\n${licenseFile.text.trim()}\n`),
    ].join("\n"),
  );
  const embeddedSections = embeddedNotices.map((notice) => `${notice.trim()}\n`);
  const commentSections =
    legalComments.trim() === "" ? [] : [`Notices in comments of the bundled code:\n\n${legalComments.trim()}\n`];
  // Blank lines part the sections rather than a rule of dashes, which a screen reader reads out dash by dash.
  return [
    "dist/index.cjs bundles these packages, each under the licence that follows its name.\n",
    ...packageSections,
    ...embeddedSections,
    ...commentSections,
  ].join("\n\n");
}
