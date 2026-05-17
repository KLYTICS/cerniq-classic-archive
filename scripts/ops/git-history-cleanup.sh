#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Remove legacy/runtime/build artifacts from all git history.
#
# Performs the rewrite on a fresh mirror clone so the operation is fully
# reversible up until the push step. Prints a before/after size comparison
# and then STOPS. Pushing is a second, explicit command.
#
# ──────────────────────────────────────────────────────────────────────
# BLAST RADIUS — read before running
# ──────────────────────────────────────────────────────────────────────
#  - Rewrites every commit SHA that touched the target artifact paths.
#  - Everyone with a local clone of cerniq must either re-clone or
#    git fetch + git reset --hard origin/<branch>. Local unmerged
#    branches need manual rebase onto the new main.
#  - All open PRs become invalid and must be closed + re-opened from
#    the rebased branch. At time of writing there are 0 open PRs.
#  - Commit links in Slack/docs/tickets keep working as redirects
#    (GitHub keeps old SHAs queryable) but won't appear in `git log`.
#
# REQUIREMENTS
#   - git-filter-repo installed: `brew install git-filter-repo`
#   - Everyone on the team has pushed any in-flight work to origin
#   - No open PRs targeting main (verify: `gh pr list --state open`)
#   - You've announced a ~30-minute git freeze
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ORIGIN="git@github.com:monykiss/cerniq.git"
TARGET_DIRS=(archive crates platform projects .omx)   # directories to remove from history
TARGET_GLOBS=(
  'Cerniq-*'
  '**/.next/**'
  '**/dist/**'
  '**/build/**'
  '**/target/**'
  '**/node_modules/**'
  '**/.turbo/**'
  '**/coverage/**'
  '**/playwright-report/**'
  '**/test-results/**'
)
WORK_DIR="${WORK_DIR:-$(mktemp -d -t cerniq-filter-XXXXXX)}"
MIRROR="$WORK_DIR/cerniq.git"

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
info()  { color "36" "ℹ $*"; }
ok()    { color "32" "✔ $*"; }
warn()  { color "33" "⚠ $*"; }
fail()  { color "31" "✘ $*"; exit 1; }

# ─── Pre-flight ────────────────────────────────────────────────────────────
command -v git-filter-repo >/dev/null 2>&1 \
  || fail "git-filter-repo not installed — brew install git-filter-repo"

# Confirm no open PRs (soft check; requires gh)
if command -v gh >/dev/null 2>&1; then
  open_prs="$(gh pr list --repo monykiss/cerniq --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  if [[ "$open_prs" != "0" && "$open_prs" != "?" ]]; then
    warn "$open_prs open PR(s) will be invalidated by this rewrite"
    warn "→ list with: gh pr list --repo monykiss/cerniq --state open"
    read -r -p "Continue anyway? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || fail "aborted — close PRs first"
  fi
fi

info "Work dir: $WORK_DIR"
info "Origin:   $ORIGIN"
info "Removing dirs:  ${TARGET_DIRS[*]}"
info "Removing globs: ${TARGET_GLOBS[*]}"

# ─── Fresh mirror clone ────────────────────────────────────────────────────
info "Cloning fresh bare mirror (this doesn't touch your working repo)..."
git clone --mirror --no-local "$ORIGIN" "$MIRROR" >/dev/null 2>&1 || fail "clone failed"

size_before="$(du -sh "$MIRROR" | awk '{print $1}')"
info "Mirror size before cleanup: $size_before"

# ─── Filter ────────────────────────────────────────────────────────────────
cd "$MIRROR"

# Build --path arguments for each target dir
filter_args=()
for d in "${TARGET_DIRS[@]}"; do
  filter_args+=(--path "$d/" --invert-paths)
done

# git-filter-repo wants one invocation per path group when mixing includes/excludes,
# but since we only EXCLUDE, we can pass all paths at once:
exclude_args=()
for d in "${TARGET_DIRS[@]}"; do
  exclude_args+=(--path-glob "$d/**" --path "$d/")
done
for g in "${TARGET_GLOBS[@]}"; do
  exclude_args+=(--path-glob "$g")
done
exclude_args+=(--invert-paths)

info "Rewriting history..."
git filter-repo --force "${exclude_args[@]}"

# ─── Verify ────────────────────────────────────────────────────────────────
# Re-pack aggressively
git reflog expire --expire=now --all
git gc --prune=now --aggressive >/dev/null 2>&1

size_after="$(du -sh "$MIRROR" | awk '{print $1}')"
refs_count="$(git for-each-ref | wc -l | tr -d ' ')"

ok "Cleanup complete"
echo
echo "  Before: $size_before"
echo "  After:  $size_after"
echo "  Refs:   $refs_count"
echo

# Make sure the rewritten history is valid + nothing from archive/ remains
remaining="$(
  git log --all --oneline --name-only |
    awk -v pats="^(${TARGET_DIRS[*]// /|})/" '
      $0 ~ pats ||
      $0 ~ /^Cerniq-/ ||
      $0 ~ /(^|\/)\.next\// ||
      $0 ~ /(^|\/)(dist|build|target|node_modules|coverage|playwright-report|test-results)\// {
        print
      }
    ' |
    head -5 || true
)"
if [[ -n "$remaining" ]]; then
  fail "UNEXPECTED: paths still present in history — aborting before push"
fi
ok "Verified: no target paths remain in any commit"

echo
cat <<EOF
────────────────────────────────────────────────────────────────────────
NEXT STEPS (manual — the script stops here on purpose)
────────────────────────────────────────────────────────────────────────

1.  Announce the git freeze in Slack / Linear before pushing.

2.  Force-push the rewritten history:

      cd $MIRROR
      git push --mirror --force

    (This pushes ALL refs — branches + tags — with the rewritten SHAs.)

3.  On your local working clone (and every team member's clone):

      git fetch origin
      git reset --hard origin/main

    For unmerged local branches, either delete or rebase onto new main.

4.  Close + re-open any PRs that existed before the rewrite.

5.  (Optional) Ask GitHub support to run "gc" on the server-side repo
    to reclaim space — mirror push doesn't always shrink the remote pack.

6.  Delete the work dir when you're done:

      rm -rf $WORK_DIR

If anything went wrong, DO NOT push. The original repo is untouched.
You can simply delete the work dir and start over.
────────────────────────────────────────────────────────────────────────
EOF
