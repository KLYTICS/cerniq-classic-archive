#!/usr/bin/env bash

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_COVERAGE_DIR="$ROOT_DIR/backend-node/coverage"
FRONTEND_COVERAGE_DIR="$ROOT_DIR/frontend/coverage"
CI_WORKFLOW_PATH="$ROOT_DIR/.github/workflows/ci-cd.yml"

workflow_env_value() {
  local key="$1"
  local value
  value="$(
    rg -o "${key}: '[^']+'" "$CI_WORKFLOW_PATH" \
      | head -n 1 \
      | sed -E "s/.*'([^']+)'.*/\\1/"
  )"
  if [[ -z "$value" ]]; then
    printf 'Missing %s in %s\n' "$key" "$CI_WORKFLOW_PATH" >&2
    exit 1
  fi
  printf '%s' "$value"
}

run_step() {
  local label="$1"
  shift
  printf '\n== %s ==\n' "$label"
  "$@"
}

run_in_dir() {
  local dir="$1"
  shift
  (
    cd "$dir"
    "$@"
  )
}

cd "$ROOT_DIR"

printf 'CERNIQ release gate\n'
printf 'Branch: %s\n' "$(git branch --show-current)"
printf 'Policy: PR-gated release captain flow. Local gate must be green before commit, push, and PR creation.\n'

BACKEND_MIN_STATEMENTS="$(workflow_env_value BACKEND_COVERAGE_MIN_STATEMENTS)"
BACKEND_MIN_BRANCHES="$(workflow_env_value BACKEND_COVERAGE_MIN_BRANCHES)"
BACKEND_MIN_FUNCTIONS="$(workflow_env_value BACKEND_COVERAGE_MIN_FUNCTIONS)"
BACKEND_MIN_LINES="$(workflow_env_value BACKEND_COVERAGE_MIN_LINES)"
FRONTEND_MIN_STATEMENTS="$(workflow_env_value FRONTEND_COVERAGE_MIN_STATEMENTS)"
FRONTEND_MIN_BRANCHES="$(workflow_env_value FRONTEND_COVERAGE_MIN_BRANCHES)"
FRONTEND_MIN_FUNCTIONS="$(workflow_env_value FRONTEND_COVERAGE_MIN_FUNCTIONS)"
FRONTEND_MIN_LINES="$(workflow_env_value FRONTEND_COVERAGE_MIN_LINES)"

run_step "Workspace Status Snapshot" make first-gate-status
run_step "Backend Lint" run_in_dir "$ROOT_DIR/backend-node" npm run lint
run_step \
  "Backend Coverage" \
  env \
    REDIS_URL=redis://127.0.0.1:6380 \
    JWT_SECRET=release-gate-secret-must-be-at-least-32-chars \
    DATABASE_URL=postgresql://cerniq:dev_password_change_in_prod@127.0.0.1:5433/cerniq?schema=public \
    npm --prefix "$ROOT_DIR/backend-node" run test:cov -- --runInBand --coverageReporters=text-summary --coverageReporters=json-summary
run_step \
  "Backend Build" \
  env \
    JWT_SECRET=release-gate-build-secret-must-be-at-least-32-chars \
    DATABASE_URL=postgresql://cerniq:dev_password_change_in_prod@127.0.0.1:5433/cerniq?schema=public \
    npm --prefix "$ROOT_DIR/backend-node" run build
run_step "Frontend Lint" run_in_dir "$ROOT_DIR/frontend" npm run lint
run_step \
  "Frontend Build" \
  env NEXT_PUBLIC_NODE_API_URL=http://127.0.0.1:3000 \
    npm --prefix "$ROOT_DIR/frontend" run build
run_step "Frontend Coverage" run_in_dir "$ROOT_DIR/frontend" npm run test:cov
run_step "Outbound Tests" run_in_dir "$ROOT_DIR/services/outbound" python3 -m pytest tests/ -q
run_step "Shared Unit And Component Suites" make test-all
run_step "End-To-End Suites" make test-e2e
run_step \
  "Backend Coverage Gate" \
  node scripts/check-coverage-thresholds.mjs \
    "$BACKEND_COVERAGE_DIR" \
    backend \
    "$BACKEND_MIN_STATEMENTS" \
    "$BACKEND_MIN_BRANCHES" \
    "$BACKEND_MIN_FUNCTIONS" \
    "$BACKEND_MIN_LINES"
run_step \
  "Frontend Coverage Gate" \
  node scripts/check-coverage-thresholds.mjs \
    "$FRONTEND_COVERAGE_DIR" \
    frontend \
    "$FRONTEND_MIN_STATEMENTS" \
    "$FRONTEND_MIN_BRANCHES" \
    "$FRONTEND_MIN_FUNCTIONS" \
    "$FRONTEND_MIN_LINES"
run_step "Verified Status Snapshot" make first-gate-status

printf '\nRelease gate passed.\n'
printf 'Next: run make release-pr on the captain branch to commit, push, and open the PR.\n'
printf 'After merge to main, run make verify-production.\n'
