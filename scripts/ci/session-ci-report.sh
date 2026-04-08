#!/usr/bin/env bash
# session-ci-report.sh — Write ci-status.json, the machine-readable status
# artifact for cross-session collaboration.
#
# The next Claude session can download this artifact (or read it from the
# last successful run on main) to know the current state of the codebase
# without re-running the full suite. This is how we avoid duplicate work
# across parallel sessions: each session publishes what it knows, and the
# next session reads the latest published status before deciding what to do.
#
# This script is called from the quality-gate job AFTER all other jobs have
# run, so the per-job results are available via environment variables set
# by the workflow.

set -euo pipefail

REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO_ROOT"

OUT_DIR=".ci-artifacts"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/ci-status.json"

# Metadata from the workflow context (falls back to git when not in CI)
COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD)}"
SHORT_COMMIT="${COMMIT:0:7}"
BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
RUN_ID="${GITHUB_RUN_ID:-local}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-monykiss/cerniq}/actions/runs/${RUN_ID}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Per-job results passed in via environment. Default to "unknown" when not set
# (script was run outside the workflow aggregator).
TYPECHECK_RESULT="${JOB_TYPECHECK:-unknown}"
ALM_TESTS_RESULT="${JOB_ALM_TESTS:-unknown}"
GOLDEN_DRIFT_RESULT="${JOB_GOLDEN_DRIFT:-unknown}"
SCHEMA_DRIFT_RESULT="${JOB_SCHEMA_DRIFT:-unknown}"
SESSION_FRESHNESS_RESULT="${JOB_SESSION_FRESHNESS:-unknown}"

# Overall verdict: green only if every hard gate passed. session-freshness is
# soft (warning-only) so it doesn't affect the verdict.
VERDICT="red"
if [ "$TYPECHECK_RESULT" = "success" ] \
  && [ "$ALM_TESTS_RESULT" = "success" ] \
  && [ "$GOLDEN_DRIFT_RESULT" = "success" ] \
  && [ "$SCHEMA_DRIFT_RESULT" = "success" ]; then
  VERDICT="green"
fi

# Handoff doc metadata — completed checkbox count is a crude but useful
# progress signal the next session can graph over time.
HANDOFF_COMPLETED=0
HANDOFF_TOTAL=0
HANDOFF_UPDATED="false"
if [ -f docs/SESSION_HANDOFF.md ]; then
  HANDOFF_COMPLETED=$(grep -c '^- \[x\]' docs/SESSION_HANDOFF.md || echo 0)
  HANDOFF_TOTAL=$(grep -cE '^- \[[ x]\]' docs/SESSION_HANDOFF.md || echo 0)
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    if git diff --name-only HEAD~1 HEAD | grep -q '^docs/SESSION_HANDOFF.md$'; then
      HANDOFF_UPDATED="true"
    fi
  fi
fi

# Count files touched in this commit (sensitive paths only — Phase 1/2/3 work)
SENSITIVE_TOUCHED=0
if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  SENSITIVE_TOUCHED=$(
    git diff --name-only HEAD~1 HEAD \
      | grep -cE '^(backend-node/src/(alm|actions|expenses|pipeline)|backend-node/prisma)' \
      || echo 0
  )
fi

cat > "$OUT_FILE" <<EOF
{
  "schemaVersion": 1,
  "commit": "$COMMIT",
  "shortCommit": "$SHORT_COMMIT",
  "branch": "$BRANCH",
  "timestamp": "$NOW",
  "workflow": "alm-quality-gate",
  "runId": "$RUN_ID",
  "runUrl": "$RUN_URL",
  "verdict": "$VERDICT",
  "jobs": {
    "typecheck": "$TYPECHECK_RESULT",
    "almTests": "$ALM_TESTS_RESULT",
    "goldenDrift": "$GOLDEN_DRIFT_RESULT",
    "schemaDrift": "$SCHEMA_DRIFT_RESULT",
    "sessionFreshness": "$SESSION_FRESHNESS_RESULT"
  },
  "sessionHandoff": {
    "path": "docs/SESSION_HANDOFF.md",
    "completedCheckboxes": $HANDOFF_COMPLETED,
    "totalCheckboxes": $HANDOFF_TOTAL,
    "updatedInThisCommit": $HANDOFF_UPDATED
  },
  "sensitivePathsTouched": $SENSITIVE_TOUCHED
}
EOF

echo "Wrote $OUT_FILE:"
cat "$OUT_FILE"
