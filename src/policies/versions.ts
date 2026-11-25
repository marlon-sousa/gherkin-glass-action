// Policy: which release of ghg the action installs.

export interface ReleaseListing {
  readonly tag: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
}

// Semantic Versioning's version without build metadata, with the tag's optional v.
const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const VERSION = new RegExp(
  String.raw`^v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-${IDENTIFIER}(?:\.${IDENTIFIER})*)?)$`,
);
const STABLE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Without its v, or the sentence the action stops with. */
export function namedVersion(input: string): string | { readonly problem: string } {
  return VERSION.exec(input)?.[1] ?? { problem: "ghg-version must be a version of ghg, such as 1.2.0." };
}

export function majorOf(version: string): number {
  return Number.parseInt(version, 10);
}

/** Without its v; undefined when that major version has no stable release. */
export function newestStable(releases: readonly ReleaseListing[], major: number): string | undefined {
  return releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => STABLE_TAG.exec(release.tag))
    .flatMap((match) => (match ? [[match[1], match[2], match[3]].map(Number)] : []))
    .filter(([releaseMajor]) => releaseMajor === major)
    .sort(([, aMinor = 0, aPatch = 0], [, bMinor = 0, bPatch = 0]) => aMinor - bMinor || aPatch - bPatch)
    .map((numbers) => numbers.join("."))
    .at(-1);
}

/** Whether the version comes before the release, which has no pre-release part, a pre-release coming before its release. */
export function isOlder(version: string, release: string): boolean {
  const [numbers = "", preRelease] = version.split(/-(.*)/s);
  const [major = 0, minor = 0, patch = 0] = numbers.split(".").map(Number);
  const [releaseMajor = 0, releaseMinor = 0, releasePatch = 0] = release.split(".").map(Number);
  const order = major - releaseMajor || minor - releaseMinor || patch - releasePatch;
  return order < 0 || (order === 0 && preRelease !== undefined);
}
