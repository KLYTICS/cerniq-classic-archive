# CERNIQ Schema Migration Policy

## Principle

Production application startup must not run schema migrations.

Schema changes are a release activity, not a boot-time side effect. The backend
should start against an already-prepared database.

## Why

CERNIQ's production database has legacy migration history that predates the
later squash-style schema work in `backend-node/prisma/migrations/`.

That means automatic `prisma migrate deploy` on container startup is risky:

- a single failed migration can prevent the app from booting
- repeated restarts can keep re-triggering the same failure
- later migrations may assume objects that exist only in one branch of history

## Production Workflow

Schema releases still follow the repo-wide PR-gated `main` policy: get the PR green first, run the explicit migration step from a controlled release action, then merge/deploy application code.

1. Create and review migrations locally:

```bash
cd backend-node
npx prisma migrate dev --name <description>
```

2. Check target-environment status explicitly:

```bash
cd backend-node
DATABASE_URL="postgresql://..." npm run prisma:status
```

3. Apply migrations only from a controlled release step:

```bash
cd backend-node
DATABASE_URL="postgresql://..." ALLOW_SCHEMA_MIGRATIONS=true npm run prisma:deploy
```

4. Deploy application code only after the schema step succeeds.

5. Verify:

```bash
curl https://api.cerniq.io/ready
curl https://api.cerniq.io/health
```

## Guardrails

- Do not run `prisma migrate reset` in production.
- Do not use `prisma db push` in production.
- Do not reintroduce `prisma migrate deploy` into container startup commands.
- If `npm run prisma:status` reports failed migrations, repair migration state
  first before applying additional schema changes.

## Current State

- Railway runtime startup is `node dist/src/main.js`
- Explicit production migration command is `npm run prisma:deploy`
- The deployment runbook must be treated as the source of truth for release flow
