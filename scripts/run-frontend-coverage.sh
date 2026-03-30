#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
FINAL_COVERAGE_DIR="$FRONTEND_DIR/coverage"
RUN_COVERAGE_DIR="$(mktemp -d "$FRONTEND_DIR/coverage-run.XXXXXX")"

cleanup() {
  rm -rf "$RUN_COVERAGE_DIR"
}

trap cleanup EXIT

mkdir -p "$RUN_COVERAGE_DIR/.tmp"

(
  cd "$FRONTEND_DIR"
  CERNIQ_VITEST_COVERAGE_DIR="$RUN_COVERAGE_DIR" \
    npx vitest run --coverage --no-file-parallelism
)

rm -rf "$FINAL_COVERAGE_DIR"
mv "$RUN_COVERAGE_DIR" "$FINAL_COVERAGE_DIR"
trap - EXIT
