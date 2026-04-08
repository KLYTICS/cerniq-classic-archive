#!/usr/bin/env bash
# golden-drift-report.sh — CerniQ ALM golden reconciliation with rich CI output.
#
# The golden tests (src/alm/golden-reconciliation.spec.ts) snapshot the real
# ALM math output for the pr-cooperativa-demo fixture. If any canonical metric
# drifts, this script surfaces it as a GitHub Actions error annotation so the
# next session can diagnose the regression without digging through jest logs.
#
# Locked decision D7 (2026-04-07): drift fails CI. NEVER auto-update golden
# files in CI — the manual regen (UPDATE_GOLDEN=1 + review diff + commit) is
# the gate. See docs/SESSION_HANDOFF.md §1 for the full decision log.

set -euo pipefail

REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO_ROOT/backend-node"

echo "🔬 Running ALM golden reconciliation suite..."
echo ""

# Run the dedicated golden spec. Capture output + exit code without
# short-circuiting the script so we can emit rich annotations on failure.
set +e
OUTPUT=$(npx jest src/alm/golden-reconciliation.spec.ts --no-coverage --forceExit 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT"

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "::notice title=ALM Math Locked::Golden reconciliation passed — canonical ALM output unchanged from test/golden/pr-cooperativa-demo.*.json"
  exit 0
fi

# Drift detected — build a rich annotation so the fix path is obvious.
cat <<'EOF'

::error title=ALM Math Drift Detected::Golden reconciliation failed

One or more of the canonical ALM calculations produced different output
than what's locked in test/golden/pr-cooperativa-demo.*.json.

This is the intended behavior of the golden tests — they are the ALM
immune system. When this fails, it means either:

  1. A bug was introduced in the ALM math (preferred — read the diff
     carefully, find the offending commit, fix the code).

  2. The math changed intentionally (e.g. a benchmark threshold was
     updated, a calculation was fixed, decimal.js was introduced).
     In that case:

       - Run locally: cd backend-node && UPDATE_GOLDEN=1 npx jest src/alm/golden-reconciliation.spec.ts
       - Review the diff in test/golden/pr-cooperativa-demo.*.json
       - Commit the updated JSON files WITH a commit message that
         explains what changed and why. Include the math delta in
         the PR description.
       - Never regenerate blindly. The manual review IS the gate.

Cross-session collab note: if you see drift and you didn't touch ALM
math, another Claude session probably did. Check docs/SESSION_HANDOFF.md
§5 (Recent landings) and §3 (File cursors) to see what other sessions
are working on.
EOF

exit 1
