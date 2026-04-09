#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

MODE="${1:-}"

BANNED_PATTERN='^(\.omx/metrics\.json|\.omx/state/.*\.json|frontend/playwright-report/.*|frontend/test-results/.*)$'

red() { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }

if [[ "$MODE" == "--staged-only" ]]; then
  staged="$(git diff --cached --name-status --diff-filter=ACMR)"
  banned_staged="$(printf '%s\n' "$staged" | awk '{print $2}' | grep -E "$BANNED_PATTERN" || true)"

  if [[ -n "$banned_staged" ]]; then
    red "Refusing commit: staged volatile/generated files detected."
    printf '%s\n' "$banned_staged"
    exit 1
  fi

  green "Staged-file cleanliness check passed."
  exit 0
fi

tracked_volatile="$(git ls-files | grep -E "$BANNED_PATTERN" || true)"
if [[ -n "$tracked_volatile" ]]; then
  red "Tracked volatile/generated files must be removed from version control:"
  printf '%s\n' "$tracked_volatile"
  exit 1
fi

git update-index -q --refresh

tracked_changes="$(git status --short --untracked-files=no || true)"
if [[ -n "$tracked_changes" ]]; then
  red "Tracked files changed during verification or local runtime activity:"
  printf '%s\n' "$tracked_changes"
  yellow "Expected a clean tracked worktree."
  exit 1
fi

green "Clean tracked worktree verified."
