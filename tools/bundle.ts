// Tool: bundles the three actions into dist/, with dist/licenses.txt, the licences of the packages they hold.
// Usage: npm run bundle

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path, { join } from "node:path";
import { build } from "esbuild";
import {
  embeddedCodeOf,
  licenseFilesOf,
  licenseFoldersOf,
  licensesText,
  packageFieldsOf,
  packageFoldersOf,
  type BundledPackage,
} from "./bundled_licenses.ts";

const ENTRY_POINTS = {
  index: "src/main.ts",
  "publish/index": "src/publish_main.ts",
  "preview/index": "src/preview_main.ts",
};

const bundleResult = await build({
  entryPoints: ENTRY_POINTS,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  charset: "utf8",
  legalComments: "external",
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  banner: { js: "// Bundled from src/ by npm run bundle. Do not edit: change src/ and bundle again." },
  metafile: true,
  write: false,
});

const bundles = bundleResult.outputFiles.filter((outputFile) => outputFile.path.endsWith(".cjs"));
if (bundles.length !== Object.keys(ENTRY_POINTS).length) throw new Error("esbuild did not write every bundle.");
// The bundles share packages, so a file of legal comments that holds the same as another's is kept once.
const legalComments = [
  ...new Set(bundleResult.outputFiles.filter((outputFile) => !bundles.includes(outputFile)).map((outputFile) => outputFile.text)),
].join("\n");

const inputPaths = Object.keys(bundleResult.metafile.inputs);
const bundledPackages: BundledPackage[] = packageFoldersOf(inputPaths).map((packageFolder) => {
  const fields = packageFieldsOf(JSON.parse(readFileSync(join(packageFolder, "package.json"), "utf8")));
  if (fields === undefined) throw new Error(`${packageFolder}/package.json does not give a name, a version and a licence.`);
  const licenseFiles = licenseFoldersOf(packageFolder, inputPaths).flatMap((folder) =>
    licenseFilesOf(readdirSync(folder)).map((fileName) => {
      const path = `${folder}/${fileName}`;
      return { path, text: readFileSync(path, "utf8") };
    }),
  );
  if (licenseFiles.length === 0) throw new Error(`${packageFolder} has no licence file.`);
  return { ...fields, licenseFiles };
});

const embeddedNotices = embeddedCodeOf(inputPaths).map((code) => {
  const embeddingPackage = bundledPackages.find((bundledPackage) => bundledPackage.name === code.packageName);
  if (embeddingPackage?.version !== code.packageVersion) {
    throw new Error(
      `${code.noticeFile} is the notice of what ${code.packageName} ${code.packageVersion} embeds: check it against the version bundled now.`,
    );
  }
  return readFileSync(code.noticeFile, "utf8");
});

// A file the bundle no longer writes then shows as deleted to the dist check.
rmSync("dist", { recursive: true, force: true });
for (const bundle of bundles) {
  mkdirSync(path.dirname(bundle.path), { recursive: true });
  writeFileSync(bundle.path, bundle.contents);
}
writeFileSync("dist/licenses.txt", licensesText(bundledPackages, embeddedNotices, legalComments));
console.log(`dist/ bundled, with the licences of ${bundledPackages.map((bundledPackage) => bundledPackage.name).join(", ")}.`);
