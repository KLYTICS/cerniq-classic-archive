#!/usr/bin/env bash

set -euo pipefail

printf 'release-main is deprecated for the captain flow.\n' >&2
printf 'Use make release-pr from the release branch before merge, then run make verify-production after main is green in GitHub Actions.\n' >&2
exit 1
