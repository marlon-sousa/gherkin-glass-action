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

// Rule 2: the first release of ghg with --message-format, whose report the action reads to build.
const FIRST_BUILDING = [1, 1, 0];

/** The sentence the action stops with when it builds with a version older than 1.1.0, if it is. */
export function buildingProblem(version: string): { readonly problem: string } | undefined {
  const [numbers = "", preRelease] = version.split(/-(.*)/s);
  const [major = 0, minor = 0, patch = 0] = numbers.split(".").map(Number);
  const [firstMajor = 0, firstMinor = 0, firstPatch = 0] = FIRST_BUILDING;
  const order = major - firstMajor || minor - firstMinor || patch - firstPatch;
  // A pre-release comes before its version, as Semantic Versioning orders them.
  const older = order < 0 || (order === 0 && preRelease !== undefined);
  return older ? { problem: `The action builds with ghg ${FIRST_BUILDING.join(".")} or newer, not ${version}.` } : undefined;
}
