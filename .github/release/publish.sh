#!/usr/bin/env bash
# Makes the GitHub release of a tag; a tag already released is left as it is.
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
# A pre-release part follows the first "-" of a version, as Semantic Versioning 2.0.0 says.
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
