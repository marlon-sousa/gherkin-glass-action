// Policy: which release of ghg the action installs, as docs/BEHAVIOUR.md, rules 2, 3 and 11, say.

/** A release as GitHub lists it. */
export interface ReleaseListing {
  readonly tag: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
}

// Semantic Versioning's version without build metadata, with the tag's optional v. A
// pre-release identifier is a number without leading zeros, or holds a letter or a hyphen.
const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const VERSION = new RegExp(
  String.raw`^v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-${IDENTIFIER}(?:\.${IDENTIFIER})*)?)$`,
);
const STABLE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** The version the input ghg-version names, without its v, or the sentence the action stops with. */
export function namedVersion(input: string): string | { readonly problem: string } {
  return VERSION.exec(input)?.[1] ?? { problem: "ghg-version must be a version of ghg, such as 1.2.0." };
}

/** The major version of a version, such as 1 for 1.2.0. */
export function majorOf(version: string): number {
  return Number.parseInt(version, 10);
}

/** The newest published stable release of that major version, without its v, if there is one. */
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
