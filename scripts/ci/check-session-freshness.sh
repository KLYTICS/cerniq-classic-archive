#!/usr/bin/env bash
# check-session-freshness.sh — Warn (non-blocking) when sensitive paths
# change without updating docs/SESSION_HANDOFF.md.
#
# The CerniQ cross-session collaboration model uses docs/SESSION_HANDOFF.md
# as the single source of truth for "what is the current state of Phase 1/2/3
# work?" When multiple Claude sessions are making parallel changes, that doc
# is how the next session picks up without duplicating work.
#
# This script runs on every CI invocation. If it detects that sensitive paths
# changed in this commit/PR without a matching update to the handoff doc, it
# emits a GitHub Actions WARNING annotation (not an error — we don't want to
# block deploys for docs hygiene). The warning surfaces in the PR review UI
# and in the job summary so the next session sees it and can backfill the
# handoff doc in a follow-up commit.

set -euo pipefail

REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO_ROOT"

echo "📝 Checking SESSION_HANDOFF.md freshness..."
echo ""

# Determine the base to diff against. In PRs, GITHUB_BASE_REF is set. On
# direct push to main, we compare against HEAD~1 (the previous commit).
BASE_REF=""
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  # We're in a PR — diff against the target branch
  git fetch --quiet origin "${GITHUB_BASE_REF}" 2>/dev/null || true
  BASE_REF="origin/${GITHUB_BASE_REF}"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  BASE_REF="HEAD~1"
else
  echo "::notice title=Session Freshness::First commit in history; skipping freshness check"
  exit 0
fi

echo "  Comparing HEAD against: $BASE_REF"

CHANGED=$(git diff --name-only "${BASE_REF}...HEAD" 2>/dev/null || git diff --name-only "${BASE_REF}" HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  echo "::notice title=Session Freshness::No file changes detected; freshness check skipped"
  exit 0
fi

# Sensitive paths: these are the Phase 1/2/3 code paths where handoff doc
# updates matter for cross-session collab. Editing a README or a test-only
# file doesn't trigger the warning.
SENSITIVE_PATHS=(
  "backend-node/src/alm/"
  "backend-node/src/actions/"
  "backend-node/src/expenses/"
  "backend-node/src/pipeline/"
  "backend-node/prisma/schema.prisma"
  "backend-node/prisma/migrations/"
)

SENSITIVE_HITS=""
for pat in "${SENSITIVE_PATHS[@]}"; do
  HITS=$(echo "$CHANGED" | grep "^${pat}" || true)
  if [ -n "$HITS" ]; then
    SENSITIVE_HITS+="$HITS"$'\n'
  fi
done

if [ -z "$SENSITIVE_HITS" ]; then
  echo "::notice title=Session Freshness::No sensitive paths changed; handoff doc check skipped"
  exit 0
fi

echo "  Sensitive paths changed in this commit:"
echo "$SENSITIVE_HITS" | sed 's/^/    /'
echo ""

# Was the handoff doc updated alongside the sensitive changes?
if echo "$CHANGED" | grep -q "^docs/SESSION_HANDOFF.md$"; then
  echo "::notice title=Session Freshness::SESSION_HANDOFF.md was updated alongside sensitive changes — good"
  exit 0
fi

# Sensitive changes without a handoff doc update. Emit a warning annotation.
# Warnings show as yellow in the PR review UI and in the job summary, but do
# NOT block the build (exit 0). The next session sees the warning and can
# backfill the handoff doc in a follow-up commit.
{
  echo "::warning title=Session Handoff Not Updated::Sensitive paths changed without updating docs/SESSION_HANDOFF.md"
  echo ""
  echo "Changed paths that matter for cross-session collab:"
  echo "$SENSITIVE_HITS" | sed 's/^/  - /'
  echo ""
  echo "The CerniQ cross-session collaboration model uses docs/SESSION_HANDOFF.md"
  echo "as the single source of truth for \"what is the current state?\" When"
  echo "sensitive paths change without updating the handoff doc, future Claude"
  echo "sessions get an incomplete picture and may duplicate work or miss open"
  echo "items."
  echo ""
  echo "Please update the relevant section of SESSION_HANDOFF.md in a follow-up"
  echo "commit:"
  echo ""
  echo "  §2  Phase status — if you completed or started a checkbox"
  echo "  §3  File cursors — if you moved or added a cursor"
  echo "  §5  Recent landings — add a one-line entry with file:line references"
  echo "  §6  Report quality matrix — if you changed a producer's rating"
  echo "  §9  Right-now safety status — if you changed what's safe to call"
  echo ""
  echo "This is a WARNING, not an error. The build still passes."
}

# Deliberately exit 0: freshness is a soft gate, not a hard fail.
exit 0
