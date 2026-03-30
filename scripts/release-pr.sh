#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DATE="$(date '+%Y-%m-%d')"
DEFAULT_LABEL="first-gate release captain ${RELEASE_DATE}"
RELEASE_LABEL="${1:-$DEFAULT_LABEL}"
COMMIT_MESSAGE="${CERNIQ_RELEASE_COMMIT_MESSAGE:-release(pr): ${RELEASE_LABEL}}"
PR_TITLE="${CERNIQ_RELEASE_PR_TITLE:-[codex] ${RELEASE_LABEL}}"

run_step() {
  local label="$1"
  shift
  printf '\n== %s ==\n' "$label"
  "$@"
}

cd "$ROOT_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" || "$CURRENT_BRANCH" == "main" ]]; then
  printf 'release-pr must run from a dedicated release branch. Current branch: %s\n' "${CURRENT_BRANCH:-detached-head}" >&2
  exit 1
fi

run_step "Workspace Status Snapshot" make first-gate-status
run_step "Full Release Gate" make release-gate
run_step "Stage Release Candidate" git add -A

if git diff --cached --quiet; then
  printf '\nNo staged changes to commit after the release gate. Nothing to push.\n'
  exit 0
fi

printf '\nRelease commit message: %s\n' "$COMMIT_MESSAGE"
run_step "Commit Release Candidate" git commit -m "$COMMIT_MESSAGE"
run_step "Push Branch" git push -u origin "$CURRENT_BRANCH"

TMP_BODY="$(mktemp)"
cat >"$TMP_BODY" <<EOF
## Summary

- Release captain integration branch for first-gate hardening.
- Local release gate and clean build path are verified on this branch.
- Quant-sensitive paths keep the same-day \`-7%\` stress standard and current coordination docs reflect the release workflow.

## Verification

- \`make release-gate\`
- \`make first-gate-status\`

## Residual Risks

- Repo-wide coverage is still below the long-term literal-100 target.
- Merge remains blocked until required GitHub checks pass on this PR.

## Deploy Notes

- After merge to \`main\`, backend auto-deploys to Railway and frontend auto-deploys to Vercel.
- Run \`make verify-production\` after the merge and green GitHub Actions.
EOF

run_step \
  "Create Pull Request" \
  env GH_PROMPT_DISABLED=1 GIT_TERMINAL_PROMPT=0 \
    gh pr create --base main --head "$CURRENT_BRANCH" --title "$PR_TITLE" --body-file "$TMP_BODY"

rm -f "$TMP_BODY"

printf '\nRelease PR flow completed successfully.\n'
