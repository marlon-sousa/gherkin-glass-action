// Policy: the checksum SHA256SUMS lists for an archive, as docs/BEHAVIOUR.md, rule 5, says.

/**
 * The SHA-256 the file lists for the archive, in lower case, if it lists it. Each line is
 * written as sha256sum writes it, the checksum, two spaces and the name, or a space and
 * a star before a name read in binary mode.
 */
export function listedChecksum(sums: string, archive: string): string | undefined {
  return sums
    .split(/\r?\n/)
    .map((line) => /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line))
    .find((match) => match?.[2] === archive)?.[1]
    ?.toLowerCase();
}
