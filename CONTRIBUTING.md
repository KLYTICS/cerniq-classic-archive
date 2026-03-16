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
npm install --legacy-peer-deps
npx prisma migrate dev
npm run start:dev

# 5. Frontend (new terminal)
cd frontend
bun install
bun run dev
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

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure CI passes: `make lint && make test`
4. Open a PR with a clear description of what/why
5. Request review from a team member

### PR Checklist
- [ ] Tests pass (`npm test` in backend-node)
- [ ] Types compile (`npx tsc --noEmit`)
- [ ] Prisma schema validates (`npx prisma validate`)
- [ ] Lint passes (`make lint`)
- [ ] Breaking changes documented

---

## Testing

### Backend Unit Tests
```bash
cd backend-node && npm test           # Run tests
cd backend-node && npm run test:cov   # With coverage
cd backend-node && npm run test:watch # Watch mode
```

### E2E Tests
```bash
cd frontend && bun run test:e2e       # Headless
cd frontend && bun run test:e2e:ui    # With UI
```

### Test Files
- Backend: `*.spec.ts` files next to source
- E2E: `frontend/e2e/*.spec.ts` (5 specs, 38 tests)

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
