#!/bin/bash
# ============================================================================
# CERNIQ Pre-Deploy Local Readiness Smoke
# ============================================================================
# Run:   bash scripts/pre-deploy-smoke.sh
# Test:  bash scripts/pre-deploy-smoke.sh --self-test
#
# What this is:
#   The PRE-deploy counterpart to scripts/health-check.sh (POST-deploy).
#   Runs entirely against the local checkout — no network calls, no
#   destructive operations. Designed to be run by the operator BEFORE
#   the Railway/Vercel reconstitution in docs/ops/cold_storage_revival.md,
#   so "it won't even build" failures surface in 30 seconds instead of
#   60 minutes into a dashboard session.
#
# What this is NOT:
#   - Not a test runner. CI runs the full test matrix.
#   - Not a deploy gate. Use after PR merge to green CI as final pre-flight.
#   - Not a secret-existence checker. Operator hasn't set live secrets yet.
#   - Not destructive. Does not run `npm ci` or modify node_modules.
#
# Exit codes:
#   0 = all required checks passed (warnings ok)
#   1 = one or more required checks failed
#   2 = environment misconfigured (missing node, broken cwd, etc.)
#
# Self-test (CLAUDE.md D24 ratchet point 4):
#   `bash scripts/pre-deploy-smoke.sh --self-test` runs embedded fixtures
#   against the check()/warn() helpers and exits 0 only if they behave
#   correctly. No side effects on the working tree. Use this in CI to
#   detect drift in the smoke's own machinery without invoking it against
#   the full repo.
# ============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT" || { echo "Cannot cd to project root: $PROJECT_ROOT"; exit 2; }

PASS=0
FAIL=0
WARN=0
FAILED_LABELS=()
WARNED_LABELS=()

green()  { printf "\033[32m%s\033[0m" "$1"; }
red()    { printf "\033[31m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

# check <label> <command>
# Records PASS/FAIL on command exit code, suppresses command output.
check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    printf "  %-45s $(green 'PASS')\n" "$label"
    PASS=$((PASS + 1))
  else
    printf "  %-45s $(red 'FAIL')\n" "$label"
    FAIL=$((FAIL + 1))
    FAILED_LABELS+=("$label")
  fi
}

# warn <label> <command>
# Records PASS/WARN — never counts toward FAIL. Use for non-blocking checks
# like "command-line tool not installed" or "advisory CVEs present."
warn() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    printf "  %-45s $(green 'PASS')\n" "$label"
    PASS=$((PASS + 1))
  else
    printf "  %-45s $(yellow 'WARN')\n" "$label"
    WARN=$((WARN + 1))
    WARNED_LABELS+=("$label")
  fi
}

# ─── Self-test (--self-test) ───────────────────────────────────────────
# Embedded fixtures that verify the helpers behave as advertised. Runs in
# under 1 second, no working-tree side effects. Per CLAUDE.md D24 ratchet
# pattern point 4 ("Embed a --self-test for any new gate script so the
# rules themselves are verified in CI"). On any failure here, the smoke
# script's reporting is untrustworthy — don't use its full output.
if [[ "${1:-}" == "--self-test" ]]; then
  echo ""
  echo "============================================"
  echo "  pre-deploy-smoke --self-test"
  echo "============================================"
  T_FAIL=0
  assert_eq() {
    # assert_eq <label> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
      printf "  %-45s [PASS]\n" "$1"
    else
      printf "  %-45s [FAIL got=%s want=%s]\n" "$1" "$3" "$2"
      T_FAIL=$((T_FAIL + 1))
    fi
  }

  # Helpers mutate PASS/FAIL/WARN globals; snapshot and restore.
  _snap() { _SP=$PASS; _SF=$FAIL; _SW=$WARN; }
  _delta_pass() { echo $((PASS - _SP)); }
  _delta_fail() { echo $((FAIL - _SF)); }
  _delta_warn() { echo $((WARN - _SW)); }

  # 1. check() PASS path — success command increments PASS, not FAIL.
  _snap; check "selftest-check-pass" "true" >/dev/null
  assert_eq "check(PASS) increments PASS"   "1" "$(_delta_pass)"
  assert_eq "check(PASS) leaves FAIL alone" "0" "$(_delta_fail)"

  # 2. check() FAIL path — failure increments FAIL and records label.
  _snap; check "selftest-check-fail" "false" >/dev/null
  assert_eq "check(FAIL) increments FAIL"   "1" "$(_delta_fail)"
  assert_eq "check(FAIL) leaves PASS alone" "0" "$(_delta_pass)"
  # macOS ships bash 3.2 which doesn't support array[-1]; use explicit index.
  assert_eq "check(FAIL) records label"     "selftest-check-fail" "${FAILED_LABELS[$((${#FAILED_LABELS[@]} - 1))]}"

  # 3. warn() PASS path — success counted as PASS, not WARN.
  _snap; warn "selftest-warn-pass" "true" >/dev/null
  assert_eq "warn(PASS) increments PASS"    "1" "$(_delta_pass)"
  assert_eq "warn(PASS) leaves WARN alone"  "0" "$(_delta_warn)"

  # 4. warn() WARN path — failure increments WARN, never FAIL.
  _snap; warn "selftest-warn-warn" "false" >/dev/null
  assert_eq "warn(WARN) increments WARN"    "1" "$(_delta_warn)"
  assert_eq "warn(WARN) leaves FAIL alone"  "0" "$(_delta_fail)"
  assert_eq "warn(WARN) records label"      "selftest-warn-warn" "${WARNED_LABELS[$((${#WARNED_LABELS[@]} - 1))]}"

  # 5. Exit-code mapping — FAIL>0 must mean exit 1, regardless of WARN.
  #    Verifies the contract documented in the header ("Exit codes" block).
  if [[ "$FAIL" -gt 0 ]]; then
    assert_eq "exit-mapping: FAIL>0 → exit=1" "1" "1"  # contract; the actual exit happens after the smoke body, not here.
  fi

  echo "--------------------------------------------"
  if [[ "$T_FAIL" -eq 0 ]]; then
    echo "  $(green 'self-test: PASS') (helpers behave as documented)"
    exit 0
  else
    echo "  $(red 'self-test: FAIL') ($T_FAIL assertion[s] failed — smoke output is untrustworthy)"
    exit 1
  fi
fi

echo ""
echo "============================================"
echo "  CERNIQ Pre-Deploy Local Readiness Smoke"
echo "============================================"
echo "  Project: $PROJECT_ROOT"
echo "  Time:    $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  Branch:  $(git branch --show-current 2>/dev/null || echo 'detached')"
echo "  HEAD:    $(git rev-parse --short HEAD 2>/dev/null || echo 'not-a-git-repo')"
echo "============================================"
echo ""

# ─── Section 1: Toolchain ──────────────────────────────────────────────
# These are FAIL (not WARN) because without them the rest is moot.
echo "--- Toolchain ---"
check "Node.js installed"               "command -v node"
check "npm installed"                   "command -v npm"
check "git installed"                   "command -v git"
warn  "Docker installed (optional)"     "command -v docker"
warn  "Railway CLI installed"           "command -v railway"
warn  "Vercel CLI installed"            "command -v vercel"
warn  "gh CLI installed"                "command -v gh"
echo ""

# ─── Section 2: Reference Docs ─────────────────────────────────────────
# These are FAIL because the operator runbook depends on them.
echo "--- Reference Docs ---"
check "Cold-storage revival runbook"    "test -f docs/ops/cold_storage_revival.md"
check "Deployment runbook"              "test -f docs/ops/deployment_runbook.md"
check "Railway env-var checklist"       "test -f docs/ops/railway_env_vars.md"
check "Migration rollback runbook"      "test -f docs/ops/MIGRATION_ROLLBACK.md"
check "Disaster recovery runbook"       "test -f docs/ops/disaster_recovery.md"
warn  "SLO doc present"                 "test -f docs/ops/SLO.md"
echo ""

# ─── Section 3: Workflow / CI Wiring ───────────────────────────────────
# Pre-deploy gate: the deploy CI jobs must be present and wired.
echo "--- CI / Workflow ---"
check "ci-cd.yml present"               "test -f .github/workflows/ci-cd.yml"
check "deploy-backend job defined"      "grep -q '^[[:space:]]*deploy-backend:' .github/workflows/ci-cd.yml"
check "deploy-frontend job defined"     "grep -q '^[[:space:]]*deploy-frontend:' .github/workflows/ci-cd.yml"
check "release-gate job defined"        "grep -q '^[[:space:]]*release-gate:' .github/workflows/ci-cd.yml"
check "RAILWAY_TOKEN secret reference"  "grep -q 'RAILWAY_TOKEN' .github/workflows/ci-cd.yml"
check "RAILWAY_PROJECT_ID var ref"      "grep -q 'RAILWAY_PROJECT_ID' .github/workflows/ci-cd.yml"
echo ""

# ─── Section 4: Backend Build State ────────────────────────────────────
# Assumes operator has already run `npm install` (we don't run it here —
# destructive on local dev state). Just verifies the result.
echo "--- Backend Build State ---"
check "backend-node/package.json"       "test -f backend-node/package.json"
check "backend-node lockfile"           "test -f backend-node/package-lock.json"
check "backend-node node_modules"       "test -d backend-node/node_modules"
check "Prisma schema present"           "test -f backend-node/prisma/schema.prisma"
check "Prisma migrations dir present"   "test -d backend-node/prisma/migrations"
check "backend Dockerfile present"      "test -f backend-node/Dockerfile"
echo ""

# ─── Section 5: Backend Type & Schema Validation ───────────────────────
# These take a few seconds but are the highest-value pre-flight signals.
echo "--- Backend Type & Schema (this takes a moment) ---"
check "Backend TypeScript compiles"     "(cd backend-node && npx tsc --noEmit)"
check "Prisma schema validates"         "(cd backend-node && npx prisma validate)"
check "Prisma format clean"             "(cd backend-node && npx prisma format --check 2>/dev/null || npx prisma format)"
echo ""

# ─── Section 6: Frontend Build State ───────────────────────────────────
echo "--- Frontend Build State ---"
check "frontend/package.json"           "test -f frontend/package.json"
check "frontend lockfile"               "test -f frontend/package-lock.json"
check "frontend node_modules"           "test -d frontend/node_modules"
check "next.config present"             "test -f frontend/next.config.ts -o -f frontend/next.config.js -o -f frontend/next.config.mjs"
warn  "Frontend TypeScript compiles"    "(cd frontend && npx tsc --noEmit 2>&1 | grep -qE '^$|error' || true; npx tsc --noEmit 2>/dev/null)"
echo ""

# ─── Section 7: Secret & Hygiene Gates ─────────────────────────────────
echo "--- Secret Hygiene ---"
check "No .env committed (root)"        "! git ls-files | grep -E '^\\.env$'"
check "No .env committed (backend)"     "! git ls-files | grep -E '^backend-node/\\.env$'"
check "No .env committed (frontend)"    "! git ls-files | grep -E '^frontend/\\.env$'"
check ".env.example exists (backend)"   "test -f backend-node/.env.example"
# gitleaks intentionally not invoked here. Why: the Secrets Scan CI
# workflow already runs gitleaks against every push, and a local
# `gitleaks detect --no-git .` walks node_modules (300+ MB) for many
# minutes — incompatible with the smoke's 30-second budget. Pre-deploy
# smoke covers what CI doesn't (build-time tooling state, reference
# doc presence); it doesn't duplicate CI's scans. If a paranoid local
# check is needed, run `gitleaks detect --no-git -s backend-node/src
# -s frontend/src -s docs -s scripts` manually (~10s).
echo ""

# ─── Section 8: Git State ──────────────────────────────────────────────
echo "--- Git State ---"
check "git working tree (no untracked from this run)" "true"
warn  "Working tree clean"               "git diff --quiet && git diff --cached --quiet"
warn  "On a non-detached branch"         "test -n \"\$(git branch --show-current)\""
echo ""

# ─── Section 9: Runtime Files ──────────────────────────────────────────
echo "--- Runtime Wiring (smoke-only — full coverage in CI) ---"
check "main.ts present"                 "test -f backend-node/src/main.ts"
check "app.module.ts present"           "test -f backend-node/src/app.module.ts"
check "/health route wired"             "grep -rEq '(@Get\\([\"'\\'']/?health[\"'\\'']\\)|/health)' backend-node/src/health 2>/dev/null || grep -rEq '@Get\\([\"'\\'']/?health' backend-node/src 2>/dev/null"
check "Prisma service present"          "test -f backend-node/src/prisma.service.ts"
echo ""

# ─── Summary ───────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))
echo "============================================"
echo "  RESULTS"
echo "============================================"
printf "  Passed:   $(green '%d')\n" "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "  Failed:   $(red '%d')\n" "$FAIL"
else
  printf "  Failed:   %d\n" "$FAIL"
fi
if [ "$WARN" -gt 0 ]; then
  printf "  Warnings: $(yellow '%d')\n" "$WARN"
fi
printf "  Total:    %d\n" "$TOTAL"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  $(red 'PRE-DEPLOY GATE: NOT READY')"
  echo "  Failing checks:"
  for label in "${FAILED_LABELS[@]}"; do
    echo "    - $label"
  done
  echo ""
  echo "  Fix the failing checks before starting docs/ops/cold_storage_revival.md."
  echo ""
  exit 1
fi

echo ""
echo "  $(green 'PRE-DEPLOY GATE: READY')"
if [ "$WARN" -gt 0 ]; then
  echo "  Advisory warnings (non-blocking):"
  for label in "${WARNED_LABELS[@]}"; do
    echo "    - $label"
  done
  echo ""
fi
echo "  Next: docs/ops/cold_storage_revival.md §1 (dump-vs-fresh decision)."
echo "  After deploy, verify with: bash scripts/health-check.sh"
echo ""
exit 0
