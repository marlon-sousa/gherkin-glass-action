#!/usr/bin/env bash
# Prints the notes CHANGELOG.md holds for a version, as docs/BEHAVIOUR.md,
# "Releases", rule 15, says: the lines under its heading "## [<version>]", to
# the next heading of level 1 or 2, or to the link definitions that close the
# file, without the blank lines around them. Prints nothing when there are none.
# Usage: notes.sh <version>
# Run from the repository's root.
set -euo pipefail

awk -v heading="## [$1]" '
    $0 == heading || index($0, heading " ") == 1 { inside = 1; next }
    inside && (/^##?[ \t]/ || /^\[[^]]+\]:[ \t]/) { exit }
    inside { lines[++count] = $0 }
    END {
        first = 1; while (first <= count && lines[first] ~ /^[ \t\r]*$/) first++
        last = count; while (last >= first && lines[last] ~ /^[ \t\r]*$/) last--
        for (i = first; i <= last; i++) print lines[i]
    }
' CHANGELOG.md
