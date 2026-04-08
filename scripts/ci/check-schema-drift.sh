#!/usr/bin/env bash
# check-schema-drift.sh — Detect drift between schema.prisma and migration history.
#
# The CerniQ repo has multiple parallel Claude sessions that can each edit
# backend-node/prisma/schema.prisma. If one session adds a field without
# generating a migration (or vice versa), the schema + migrations go out of
# sync and the next prisma migrate deploy blows up in production.
#
# Two operating modes:
#
#   1. CI mode (SHADOW_DATABASE_URL set): runs the full `prisma migrate diff`
#      with a postgres shadow database. This is the strict check — it computes
#      the SQL that would be needed to bring the migration-applied state into
#      sync with schema.prisma. Empty output = clean.
#
#   2. Local mode (no SHADOW_DATABASE_URL): falls back to `prisma validate`
#      which catches syntax errors and dangling references but NOT true
#      schema/migration drift. This is enough for most local pre-commit
#      hygiene — the CI strict check is the real gate.
#
# Exit codes:
#   0 — clean
#   1 — drift detected, validation error, or tool error

set -euo pipefail

REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO_ROOT/backend-node"

echo "🔍 Checking Prisma schema drift..."
echo ""

# ── Local fallback: no shadow DB, run prisma validate ──
if [ -z "${SHADOW_DATABASE_URL:-}" ]; then
  echo "  SHADOW_DATABASE_URL not set — running prisma validate only"
  echo "  (For strict drift detection, set SHADOW_DATABASE_URL to a postgres URL)"
  echo ""

  set +e
  VALIDATE_OUTPUT=$(npx prisma validate 2>&1)
  VALIDATE_EXIT=$?
  set -e

  if [ $VALIDATE_EXIT -eq 0 ]; then
    echo "::notice title=Schema Validation::prisma validate passed (syntax + references OK)"
    echo ""
    echo "Note: this is the local fallback. Strict drift detection requires CI."
    exit 0
  fi

  echo "::error title=Schema Invalid::prisma validate failed"
  echo ""
  echo "$VALIDATE_OUTPUT"
  exit 1
fi

# ── CI strict mode: full migrate diff against shadow DB ──
echo "  Running strict drift check against shadow DB"
echo ""

# Generate the SQL that would be needed to bring the migration-history state
# into sync with schema.prisma. Empty output = clean. Non-empty = drift.
set +e
DRIFT_SQL=$(DATABASE_URL="$SHADOW_DATABASE_URL" SHADOW_DATABASE_URL="$SHADOW_DATABASE_URL" npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --script 2>&1)
PRISMA_EXIT=$?
set -e

if [ $PRISMA_EXIT -ne 0 ]; then
  echo "::error title=Prisma migrate diff failed::Could not compute schema drift"
  echo ""
  echo "prisma migrate diff exited with code $PRISMA_EXIT"
  echo ""
  echo "$DRIFT_SQL"
  exit 1
fi

# Strip comments, blank lines, and Prisma's own info lines. Anything left is
# real SQL that would need to run to bring the migration history in sync with
# schema.prisma — which means there's drift.
REAL_SQL=$(
  echo "$DRIFT_SQL" \
    | grep -v '^--' \
    | grep -v '^$' \
    | grep -v 'Prisma schema loaded' \
    | grep -v 'Loaded Prisma config' \
    | grep -v 'Environment variables loaded' \
    | tr -d '[:space:]' || true
)

if [ -z "$REAL_SQL" ]; then
  echo "::notice title=Schema OK::schema.prisma is in sync with migration history"
  exit 0
fi

cat <<EOF
::error title=Schema Drift Detected::schema.prisma is out of sync with migration history

The schema.prisma file declares state that running all migrations against
an empty database would NOT produce. This means either:

  - A session edited schema.prisma without generating a migration
  - A session generated a migration but forgot to update schema.prisma
  - Two sessions each added different schema changes that don't stack
    cleanly

## How to fix

Run locally:

  cd backend-node
  npx prisma migrate dev --name <descriptive-name-of-your-change>

That generates a new migration file matching your schema.prisma edits,
then applies it locally. Commit the new migration directory alongside
your schema.prisma change.

If you see drift and you didn't touch schema.prisma, another Claude
session probably did. Check docs/SESSION_HANDOFF.md §5 (Recent landings)
to see who's working on what.

## Generated drift SQL

This is the SQL that would need to run to bring the migration-applied
database state into sync with the current schema.prisma:

EOF

echo "$DRIFT_SQL"
exit 1
