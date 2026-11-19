#!/usr/bin/env bash
# Prints the version package.json gives the action.
set -euo pipefail
jq -r .version package.json | tr -d '\r'
