# CERNIQ Backend

NestJS 11 API for CERNIQ's ALM, onboarding, reporting, billing, portal, and analytics workflows.

## Setup

```bash
npm ci
npm run prisma:generate
```

Run migrations if you are bringing up a local database for the first time:

```bash
npx prisma migrate dev
```

## Local Development

```bash
npm run start:dev
```

## Testing

```bash
# Unit tests
npm test

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

`npm test`, `npm run test:cov`, and `npm run test:e2e` now auto-generate the Prisma client before execution, which makes fresh-clone onboarding much more reliable.

Coverage artifacts are written to [`backend-node/coverage`](/Users/automation/Desktop/CERNIQ%20III-XXIX/backend-node/coverage).
For the latest verified cross-repo baselines, run `make first-gate-status` from the repo root or check [docs/TERMINAL_COORDINATION.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/TERMINAL_COORDINATION.md).

## Related Docs

- [Architecture](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ARCHITECTURE.md)
- [Backend Reference](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/BACKEND.md)
- [Environment](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ENVIRONMENT.md)
- [Deployment Checklist](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/DEPLOYMENT_CHECKLIST.md)
