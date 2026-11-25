// Policy: the checksum SHA256SUMS lists for an archive.

/** In lower case, undefined when the archive is not listed; lines are as sha256sum writes them, in text or binary mode. */
export function listedChecksum(sums: string, archive: string): string | undefined {
  return sums
    .split(/\r?\n/)
    .map((line) => /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line))
    .find((match) => match?.[2] === archive)?.[1]
    ?.toLowerCase();
}
