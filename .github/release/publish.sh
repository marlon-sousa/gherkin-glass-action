#!/usr/bin/env bash
# Makes the GitHub release of a tag, as docs/BEHAVIOUR.md, "Releases", rule
# 16, says: titled with the tag, with the version's notes from CHANGELOG.md,
# a pre-release when the version has a pre-release part, marked latest only
# when it is the newest version without one among the repository's tags, and
# with no files. A tag already released is left as it is.
# Usage: publish.sh <tag>
# Run from the repository's root, in a clone with every tag, with gh signed in.
set -euo pipefail

tag=$1
version=${tag#v}
here=$(dirname "$0")

if gh release view "$tag" > /dev/null 2>&1; then
    echo "$tag is already released."
    exit 0
fi

notes=$("$here/notes.sh" "$version")
release=(release create "$tag" --verify-tag --title "$tag" --notes "$notes")
# A pre-release part follows the first "-" of a version (semver.org, item 9).
if [[ $version == *-* ]]; then
    release+=(--prerelease --latest=false)
else
    newest=$(git tag --list 'v*' | { grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true; } | sort -V | tail -n 1)
    if [ "$tag" = "$newest" ]; then
        release+=(--latest)
    else
        release+=(--latest=false)
    fi
fi
gh "${release[@]}"
echo "$tag is released."
