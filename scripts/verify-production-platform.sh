#!/usr/bin/env bash
# Production platform E2E orchestrator — Tier B gate.
#
# Usage:
#   source .env.production-e2e.local   # full mode only
#   bash scripts/verify-production-platform.sh [--fast] [--skip-agents] [--json-out path]
#
# Exit 0 when all non-skipped phases pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

API_URL="${CERNIQ_API_URL:-https://api.cerniq.io}"
FRONTEND_URL="${CERNIQ_FRONTEND_URL:-https://cerniq.io}"
JSON_OUT=""
FAST=0
SKIP_AGENTS=0
SKIP_FRONTEND=0

PASS=0
FAIL=0
SKIP=0
PHASE_RESULTS="[]"
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast) FAST=1; shift ;;
    --skip-agents) SKIP_AGENTS=1; shift ;;
    --skip-frontend) SKIP_FRONTEND=1; shift ;;
    --json-out)
      JSON_OUT="${2:?--json-out requires a path}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

record_phase() {
  local name="$1" status="$2" detail="${3:-}"
  local escaped
  escaped=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$detail")
  PHASE_RESULTS=$(python3 -c "
import json
phases = json.loads('''$PHASE_RESULTS''')
phases.append({'phase': '$name', 'status': '$status', 'detail': $escaped})
print(json.dumps(phases))
")
}

run_phase() {
  local name="$1"
  shift
  echo ""
  echo "════════════════════════════════════════"
  echo "  Phase: $name"
  echo "════════════════════════════════════════"
  if "$@"; then
    echo "  → $name: PASS"
    PASS=$((PASS + 1))
    record_phase "$name" "pass" ""
    return 0
  else
    echo "  → $name: FAIL"
    FAIL=$((FAIL + 1))
    record_phase "$name" "fail" ""
    return 1
  fi
}

skip_phase() {
  local name="$1" reason="$2"
  echo ""
  echo "════════════════════════════════════════"
  echo "  Phase: $name (skipped)"
  echo "  Reason: $reason"
  echo "════════════════════════════════════════"
  SKIP=$((SKIP + 1))
  record_phase "$name" "skip" "$reason"
}

phase0_preflight() {
  if command -v railway >/dev/null 2>&1 && [[ "${SKIP_RAILWAY_VERIFY:-}" != "1" ]]; then
    bash "$SCRIPT_DIR/ops/railway-verify-prod.sh" || true
  else
    echo "  ⊘ railway-verify skipped (no CLI or SKIP_RAILWAY_VERIFY=1)"
  fi

  if [[ "$SKIP_FRONTEND" -eq 1 ]]; then
    API_ONLY=1 bash "$SCRIPT_DIR/health-check.sh" "$API_URL" "$FRONTEND_URL"
  else
    bash "$SCRIPT_DIR/health-check.sh" "$API_URL" "$FRONTEND_URL"
  fi

  if [[ -n "${DATABASE_URL:-}" ]]; then
    (cd "$REPO_ROOT/backend-node" && npx prisma migrate status)
  else
    echo "  ⊘ prisma migrate status skipped (DATABASE_URL unset)"
    echo "    Tip: export DATABASE_URL from Railway before full gate"
  fi
}

phase1_public() {
  npm run smoke:production
}

phase2_wave1() {
  if [[ -z "${CERNIQ_E2E_JWT:-}" ]]; then
    echo "CERNIQ_E2E_JWT not set" >&2
    return 1
  fi
  local wave1_args=()
  if [[ -n "$JSON_OUT" ]]; then
    wave1_args+=(--json-out "${JSON_OUT%.json}.wave1.json")
  fi
  bash "$SCRIPT_DIR/wave1-api-smoke.sh" "${wave1_args[@]}"
}

phase3_agents() {
  if [[ -z "${CERNIQ_E2E_JWT:-}" || -z "${CERNIQ_E2E_INSTITUTION_ID:-}" ]]; then
    echo "CERNIQ_E2E_JWT and CERNIQ_E2E_INSTITUTION_ID required" >&2
    return 1
  fi
  bash "$SCRIPT_DIR/agent-smoke.sh" \
    "$API_URL" \
    "$CERNIQ_E2E_JWT" \
    "$CERNIQ_E2E_INSTITUTION_ID" \
    "${CERNIQ_E2E_CROSS_JWT:-}"
}

phase4_manual_note() {
  echo ""
  echo "── Phase 4: Manual billing (founder) ──"
  echo "  Walk docs/ops/e2e_production_gate.md (MP-OPS-03) steps 1–13."
  echo "  Do NOT auto-run Stripe unless CERNIQ_E2E_RUN_BILLING=1."
  record_phase "manual_billing" "manual" "see e2e_production_gate.md"
  return 0
}

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   CERNIQ Production Platform E2E Gate        ║"
echo "╚══════════════════════════════════════════════╝"
echo "  API:      $API_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Mode:     $([ "$FAST" -eq 1 ] && echo 'fast' || echo 'full')$([ "$SKIP_FRONTEND" -eq 1 ] && echo ' + backend-only')"
echo "  Time:     $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

FAILED=0

run_phase "phase0_preflight" phase0_preflight || FAILED=1

if [[ "$SKIP_FRONTEND" -eq 1 ]]; then
  skip_phase "phase1_public_smoke" "--skip-frontend (cerniq.io Vercel DEPLOYMENT_NOT_FOUND)"
else
  run_phase "phase1_public_smoke" phase1_public || FAILED=1
fi

if [[ "$FAST" -eq 1 ]]; then
  skip_phase "phase2_wave1_api" "--fast mode"
  skip_phase "phase3_agents" "--fast mode"
else
  run_phase "phase2_wave1_api" phase2_wave1 || FAILED=1
  if [[ "$SKIP_AGENTS" -eq 1 ]]; then
    skip_phase "phase3_agents" "--skip-agents"
  else
    run_phase "phase3_agents" phase3_agents || FAILED=1
  fi
fi

phase4_manual_note

END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
DURATION=$((END_MS - START_MS))

echo ""
echo "════════════════════════════════════════"
echo "  RESULTS"
echo "════════════════════════════════════════"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIP"
echo "  Duration: ${DURATION}ms"

if [[ -n "$JSON_OUT" ]]; then
  python3 -c "
import json
payload = {
  'script': 'verify-production-platform',
  'mode': 'fast' if $FAST else 'full',
  'apiUrl': '$API_URL',
  'frontendUrl': '$FRONTEND_URL',
  'pass': $PASS,
  'fail': $FAIL,
  'skip': $SKIP,
  'durationMs': $DURATION,
  'phases': json.loads('''$PHASE_RESULTS'''),
}
with open('$JSON_OUT', 'w') as f:
    json.dump(payload, f, indent=2)
print('Wrote summary:', '$JSON_OUT')
"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo ""
  echo "  PRODUCTION PLATFORM GATE: NOT READY"
  exit 1
fi

echo ""
echo "  PRODUCTION PLATFORM GATE: OK (billing still manual — see Phase 4)"
exit 0
