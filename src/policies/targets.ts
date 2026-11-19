// Policy: which release archive of ghg a runner installs, as docs/BEHAVIOUR.md, rule 4, says.

/** What a runner's system and processor install: the release's target, and how its archive is packed. */
export interface Platform {
  readonly target: string;
  readonly packing: "tar.gz" | "zip";
  readonly binary: "ghg" | "ghg.exe";
}

// Keyed by RUNNER_OS and RUNNER_ARCH, in the runner's own words.
const PLATFORMS: ReadonlyMap<string, Platform> = new Map([
  ["Linux/X64", { target: "x86_64-unknown-linux-musl", packing: "tar.gz", binary: "ghg" }],
  ["Linux/ARM64", { target: "aarch64-unknown-linux-musl", packing: "tar.gz", binary: "ghg" }],
  ["macOS/X64", { target: "x86_64-apple-darwin", packing: "tar.gz", binary: "ghg" }],
  ["macOS/ARM64", { target: "aarch64-apple-darwin", packing: "tar.gz", binary: "ghg" }],
  ["Windows/X64", { target: "x86_64-pc-windows-msvc", packing: "zip", binary: "ghg.exe" }],
]);

/** The platform of a runner, or the sentence the action stops with when ghg has no build for it. */
export function platformOf(system: string, processor: string): Platform | { readonly problem: string } {
  return (
    PLATFORMS.get(`${system}/${processor}`) ?? {
      problem: `ghg has no build for ${system || "this system"} on ${processor || "this processor"}.`,
    }
  );
}

/** The archive's name in the release of that version, such as ghg-v1.0.0-x86_64-unknown-linux-musl.tar.gz. */
export function archiveName(version: string, platform: Platform): string {
  return `ghg-v${version}-${platform.target}.${platform.packing}`;
}
