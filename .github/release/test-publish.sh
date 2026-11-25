#!/usr/bin/env bash
# Checks rule 16: publish.sh, in a throwaway repository with the tags each case lists and a stand-in for gh.
# Run from the repository's root.
set -euo pipefail

root=$PWD
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin" "$work/repo"
cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
# "gh release view" finds only the tags listed in $RELEASED; "gh release
# create" writes its arguments into $CREATED.
if [ "$1 $2" = "release view" ]; then
    [[ " $RELEASED " == *" $3 "* ]]
    exit
fi
printf '%s\n' "$@" > "$CREATED"
GH
chmod +x "$work/bin/gh"
git -C "$work/repo" init --quiet
git -C "$work/repo" config user.name "Release fixture"
git -C "$work/repo" config user.email "fixture@example.invalid"
git -C "$work/repo" config commit.gpgsign false
cp "$root/test/fixtures/release/changelogs/with-notes.md" "$work/repo/CHANGELOG.md"
cat >> "$work/repo/CHANGELOG.md" <<'NOTES'

## [1.3.0-rc.1]

### Added

- A candidate.
NOTES
git -C "$work/repo" add .
git -C "$work/repo" commit --quiet -m "chore: the released commit"

failures=0
# expect <tag> <tags of the repository> <released tags> <expected arguments, one a line, or nothing>
expect() {
    local tag=$1 tags=$2 released=$3 wanted=$4 output
    git -C "$work/repo" tag --list | xargs -r git -C "$work/repo" tag --delete > /dev/null
    for t in $tags; do git -C "$work/repo" tag "$t"; done
    rm -f "$work/created"
    if ! output=$(cd "$work/repo" && PATH="$work/bin:$PATH" RELEASED="$released" CREATED="$work/created" \
        "$root/.github/release/publish.sh" "$tag" 2>&1); then
        echo "publish.sh $tag failed:" >&2
        echo "$output" >&2
        failures=$((failures + 1))
        return
    fi
    local created=""
    [ -f "$work/created" ] && created=$(cat "$work/created")
    if [ "$created" != "$wanted" ]; then
        echo "publish.sh $tag, with the tags $tags, asked gh for:" >&2
        echo "${created:-nothing}" >&2
        echo "and not for:" >&2
        echo "${wanted:-nothing}" >&2
        failures=$((failures + 1))
    fi
}

notes_123=$'### Added\n\n- A page for every feature file.'
notes_rc=$'### Added\n\n- A candidate.'

# The newest version without a pre-release part is the latest release.
expect v1.2.3 "v1.2.2 v1.2.3" "" "$(printf '%s\n' release create v1.2.3 --verify-tag --title v1.2.3 --notes "$notes_123" --latest)"
# An older version, released after a newer one, is not.
expect v1.2.3 "v1.2.3 v1.10.0" "" "$(printf '%s\n' release create v1.2.3 --verify-tag --title v1.2.3 --notes "$notes_123" --latest=false)"
# A version with a pre-release part is a pre-release, never the latest.
expect v1.3.0-rc.1 "v1.2.3 v1.3.0-rc.1" "" "$(printf '%s\n' release create v1.3.0-rc.1 --verify-tag --title v1.3.0-rc.1 --notes "$notes_rc" --prerelease --latest=false)"
# A tag already released is left as it is.
expect v1.2.3 "v1.2.3" "v1.2.3" ""

if [ "$failures" -gt 0 ]; then
    echo "$failures checks of publish.sh failed." >&2
    exit 1
fi
echo "publish.sh makes every release test/fixtures/release expects, and only those."
