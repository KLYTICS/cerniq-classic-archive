# Contributing to CERNIQ

Thank you for contributing to CERNIQ. This guide covers dev setup, conventions, and workflow.

---

## Development Setup

### Prerequisites
- Node.js 20+ (we recommend [nvm](https://github.com/nvm-sh/nvm))
- Docker & Docker Compose
- Bun (optional, for frontend)

### First-Time Setup

```bash
# 1. Clone
git clone https://github.com/monykiss/cerniq.git
cd cerniq

# 2. Environment
cp .env.example .env
# Edit .env with your local values (most defaults work as-is)

# 3. Infrastructure
docker compose up -d postgres redis

# 4. Backend
cd backend-node
npm ci
npx prisma migrate dev
npm run start:dev

# 5. Frontend (new terminal)
cd frontend
npm ci
npm run dev
```

---

## Branch Naming

```
feature/short-description     # New features
fix/short-description          # Bug fixes
refactor/short-description     # Code improvements
docs/short-description         # Documentation changes
chore/short-description        # Tooling, CI, dependencies
```

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat(alm): add BPV calculation endpoint
fix(portal): handle empty CSV upload gracefully
docs(readme): update architecture diagram
chore(deps): bump prisma to 7.3
refactor(auth): consolidate JWT validation logic
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`

**Scopes:** `alm`, `auth`, `billing`, `portal`, `risk`, `frontend`, `infra`, `deps`, `ci`

---

## Mainline Process

1. Coordinate your lane in the terminal command center before touching shared-state files
2. Make your changes with appropriate tests
3. Run the repo release gate: `make release-gate`
4. Commit, push, and open a PR from the captain release branch with `make release-pr`
5. After merge to `main` and green GitHub Actions, run `make verify-production`

### Release Policy

- `main` remains the only production deployment branch, but hardening work ships through a PR branch
- local coverage gates must match the ratcheted minimums already verified in `.github/workflows/ci-cd.yml`
- `make release-gate` is the authoritative local ship gate
- `make release-pr` is the authoritative captain command for commit-plus-push-plus-PR work
- Railway and Vercel production deploys are triggered from `main`
- schema changes require the explicit migration flow in [docs/ops/schema_migration_policy.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ops/schema_migration_policy.md)
- if backend full coverage still shows the generic async-exit warning, it must be triaged and called out as residual risk in the PR before merge

### Release Checklist
- [ ] `make release-gate` passes locally
- [ ] Coverage floors in `.github/workflows/ci-cd.yml` are met locally
- [ ] `CI Quick Check` passes in GitHub on the PR
- [ ] `CERNIQ CI/CD` passes in GitHub on the PR
- [ ] Types compile (`cd backend-node && npx tsc --noEmit`)
- [ ] Prisma schema validates (`cd backend-node && npx prisma validate`)
- [ ] Lint passes (`make lint`)
- [ ] Shared-state risks are called out in terminal updates if auth/session, coverage config, or coordination docs changed
- [ ] `make verify-production` is queued for post-merge verification
- [ ] If schema changed, explicit production migration steps are documented
- [ ] Breaking changes documented

---

## Testing

### Backend Unit Tests
```bash
cd backend-node && npm test           # Auto-generates Prisma client, then runs unit tests
cd backend-node && npm run test:cov   # Auto-generates Prisma client, then writes coverage to backend-node/coverage
cd backend-node && npm run test:watch # Watch mode
cd backend-node && npm run test:e2e   # Auto-generates Prisma client, then runs e2e tests
```

### Frontend Tests
```bash
cd frontend && npm test               # Unit/component tests
cd frontend && npm run test:cov       # Coverage report in frontend/coverage
cd frontend && npm run test:e2e       # Playwright headless
cd frontend && npm run test:e2e:ui    # Playwright UI
```

### Test Files
- Backend: `*.spec.ts` files next to source
- Frontend unit/component: `*.test.ts` / `*.test.tsx`
- E2E: `frontend/e2e/*.spec.ts`

Use `make first-gate-status` for the current verified cross-repo totals instead of copying stale counts into docs or PRs.

---

## Code Style

- **TypeScript** everywhere (strict mode)
- **Prettier** for formatting (`backend-node/.prettierrc`)
- **ESLint** for linting (both backend and frontend configs)
- **Prisma** for all database operations (no raw SQL)

### Run Formatters
```bash
cd backend-node && npm run format     # Prettier
make lint                             # ESLint (both)
```

---

## Database Changes

1. Edit `backend-node/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. The migration SQL is auto-generated
4. Commit both the schema change and migration file

---

## Environment Variables

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for a complete reference. Key files:
- `.env.example` — all variables with descriptions
- `.env.production.template` — production values template
- `docker-compose.yml` — Docker-specific overrides

---

## Project Layout

| Directory | Purpose |
|-----------|---------|
| `backend-node/` | NestJS 11 API server |
| `frontend/` | Next.js 16 web app |
| `services/outbound/` | Python outbound sales engine |
| `docs/` | All project documentation |
| `infra/` | Kubernetes manifests |
| `scripts/` | Operational scripts |
| `.github/workflows/` | CI/CD pipelines |

---

## Need Help?

- Check existing docs in `docs/`
- Review the [Architecture](docs/ARCHITECTURE.md) for system overview
- Look at existing modules for patterns to follow
