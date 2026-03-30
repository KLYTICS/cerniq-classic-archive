# CERNIQ Frontend

Next.js 16 application for the public site, pricing, onboarding flows, portal UI, and ALM dashboards.

## Setup

```bash
npm ci
```

## Local Development

```bash
npm run dev
```

The app runs on `http://localhost:3001`.

## Testing

```bash
# Unit/component tests
npm test

# Coverage report
npm run test:cov

# Playwright e2e
npm run test:e2e
```

Coverage artifacts are written to [`frontend/coverage`](/Users/automation/Desktop/CERNIQ%20III-XXIX/frontend/coverage).
For the latest verified cross-repo baselines, run `make first-gate-status` from the repo root or check [docs/TERMINAL_COORDINATION.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/TERMINAL_COORDINATION.md).

## Related Docs

- [Frontend Reference](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/FRONTEND.md)
- [Architecture](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ARCHITECTURE.md)
- [Environment](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ENVIRONMENT.md)
