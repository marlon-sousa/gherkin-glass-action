#!/usr/bin/env bash
# Checks rule 13: gate.sh, with the
# changelogs of test/fixtures/release/changelogs, in a throwaway repository
# whose package.json declares version 1.2.3 and whose main holds one commit.
# Needs git and jq. Run from the repository's root.
set -euo pipefail

root=$PWD
changelogs=$root/test/fixtures/release/changelogs
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git -C "$work" init --quiet
git -C "$work" config user.name "Release fixture"
git -C "$work" config user.email "fixture@example.invalid"
git -C "$work" config commit.gpgsign false
printf '{ "name": "gherkin-glass-action", "version": "1.2.3" }\n' > "$work/package.json"
git -C "$work" add .
git -C "$work" commit --quiet -m "chore: the released commit"
on_main=$(git -C "$work" rev-parse HEAD)
git -C "$work" update-ref refs/remotes/origin/main "$on_main"
git -C "$work" commit --quiet --allow-empty -m "chore: a commit main does not have"
off_main=$(git -C "$work" rev-parse HEAD)

failures=0
# expect <changelog> <tag> <commit> <expected status> [text the output must hold]...
expect() {
    local changelog=$1 tag=$2 commit=$3 status=$4 output actual
    shift 4
    cp "$changelogs/$changelog" "$work/CHANGELOG.md"
    actual=0
    output=$(cd "$work" && "$root/.github/release/gate.sh" "$tag" "$commit" 2>&1) || actual=$?
    if [ "$actual" != "$status" ]; then
        echo "With $changelog, $tag and its commit, the gate exited with $actual, not $status:" >&2
        echo "$output" >&2
        failures=$((failures + 1))
        return
    fi
    local wanted
    for wanted in "$@"; do
        if [[ $output != *"$wanted"* ]]; then
            echo "With $changelog and $tag, the gate did not say: $wanted" >&2
            echo "$output" >&2
            failures=$((failures + 1))
        fi
    done
}

expect with-notes.md v1.2.3 "$on_main" 0 "v1.2.3 may be released."
expect with-notes.md v1.2.4 "$on_main" 1 "it must be v1.2.3."
expect with-notes.md 1.2.3 "$on_main" 1 "it must be v1.2.3."
expect with-notes.md v1.2.3 "$off_main" 1 "is not on main."
expect without-section.md v1.2.3 "$on_main" 1 'CHANGELOG.md has no notes for 1.2.3'
expect empty-section.md v1.2.3 "$on_main" 1 'CHANGELOG.md has no notes for 1.2.3'
expect without-section.md v9.9.9 "$off_main" 1 "it must be v1.2.3." "is not on main." 'has no notes for 1.2.3'

if [ "$failures" -gt 0 ]; then
    echo "$failures checks of the release gate failed." >&2
    exit 1
fi
echo "The release gate refuses every tag test/fixtures/release/changelogs expects it to, and only those."
