// Tool: bundles the action into dist/index.cjs, and writes dist/licenses.txt with the licences of the packages it holds (issue #1, decision 15).
// Usage: npm run bundle

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

const BUNDLE = "dist/index.cjs";

const bundleResult = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  charset: "utf8",
  // The notices in the code's comments go to dist/licenses.txt, not into the bundle.
  legalComments: "external",
  outfile: BUNDLE,
  banner: { js: "// Bundled from src/ by npm run bundle. Do not edit: change src/ and bundle again." },
  metafile: true,
  write: false,
});

const bundle = bundleResult.outputFiles.find((outputFile) => outputFile.path.endsWith(BUNDLE));
if (bundle === undefined) throw new Error(`esbuild wrote no ${BUNDLE}.`);
const legalComments = bundleResult.outputFiles.find((outputFile) => outputFile !== bundle)?.text ?? "";

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

// dist/ is emptied first, so that a file the bundle no longer writes shows as deleted to the dist check.
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
writeFileSync(BUNDLE, bundle.contents);
writeFileSync("dist/licenses.txt", licensesText(bundledPackages, embeddedNotices, legalComments));
console.log(`${BUNDLE} bundled, with the licences of ${bundledPackages.map((bundledPackage) => bundledPackage.name).join(", ")}.`);
