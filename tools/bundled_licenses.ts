// Tool: the licence notices of the packages bundled into the actions in dist/.

import { posix } from "node:path";

export interface LicenseFile {
  readonly path: string;
  readonly text: string;
}

export interface BundledPackage {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly licenseFiles: readonly LicenseFile[];
}

export type PackageFields = Pick<BundledPackage, "name" | "version" | "license">;

/** Code a package embeds without a licence file, whose notice tools/licenses/ keeps; another version of the package may embed another release. */
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

/** The innermost when packages nest. */
function packageFolderOf(inputPath: string): string | undefined {
  return /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(inputPath)?.[1];
}

export function packageFoldersOf(inputPaths: readonly string[]): string[] {
  const folders = inputPaths.map(packageFolderOf).filter((folder) => folder !== undefined);
  return [...new Set(folders)].sort();
}

/** Every folder between the package's and an input, since a package may keep a licence beside code it took, as undici keeps lib/web/fetch/LICENSE. */
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

export function licenseFilesOf(fileNames: readonly string[]): string[] {
  return fileNames.filter((fileName) => LICENSE_FILE.test(fileName)).sort();
}

/** Undefined when one of the fields is missing. */
export function packageFieldsOf(packageJson: unknown): PackageFields | undefined {
  if (typeof packageJson !== "object" || packageJson === null) return undefined;
  if (!("name" in packageJson && "version" in packageJson && "license" in packageJson)) return undefined;
  const { name, version, license } = packageJson;
  if (typeof name !== "string" || typeof version !== "string" || typeof license !== "string") return undefined;
  return { name, version, license };
}

export function embeddedCodeOf(inputPaths: readonly string[]): EmbeddedCode[] {
  return EMBEDDED_CODE.filter((code) => inputPaths.some((inputPath) => inputPath.startsWith(code.inputFolder)));
}

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
    "The bundles of dist/, index.cjs, publish/index.cjs and preview/index.cjs, hold these packages, each under the licence that follows its name.\n",
    ...packageSections,
    ...embeddedSections,
    ...commentSections,
  ].join("\n\n");
}
