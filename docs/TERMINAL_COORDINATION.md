# Terminal Coordination — CerniQ Enterprise Hardening
## March 27, 2026

> **Purpose:** This file coordinates work between two parallel Claude terminals working on CerniQ enterprise hardening.

---

## TERMINAL A (This Terminal) — Infrastructure & Identity Hardening

### Currently Working On:
1. **docker-compose.yml** — Fixing capexcycle → cerniq (DB name, user, container names, healthcheck, DATABASE_URL)
2. **docker-compose.prod.yml** — Same identity fixes
3. **Environment files** — Aligning .env, .env.example, .env.production.template
4. **CapexCycleOS purge** — All code references to capexcycle, capex_, klytics identity
5. **Risk controller URL** — `/risk/` → `/api/risk/` prefix fix
6. **Frontend auth keys** — `capex_auth_user` → `cerniq_auth_user` migration

### Files Being Touched (DO NOT EDIT):
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `backend-node/.env` (the one inside backend-node)
- `.env` (root)
- `.env.example`
- `.env.production.template`
- `backend-node/src/risk/risk.controller.ts`
- `backend-node/src/risk/volatility.controller.ts`
- `frontend/lib/store.ts`
- `frontend/lib/api.ts` (auth token key names only)
- `frontend/components/auth/AuthInitializer.tsx`
- `scripts/*.sh` (container name references)

---

## TERMINAL B (Other Terminal) — Available Work

### High-Priority Tasks (Pick Any):

1. **TypeScript Strict Mode** — Enable `strictNullChecks: true` and `noImplicitAny: true` in `backend-node/tsconfig.json`. This will produce compile errors. Fix them systematically module by module. Start with `tsconfig.json`, run `npx tsc --noEmit 2>&1 | head -100` to see the damage, then fix.

2. **Security Hardening (Open Items from Playbook §8.3)**:
   - Add per-user rate limits (current is global IP only) — modify `backend-node/src/common/` or throttler config
   - Secure `/health/detailed` — ensure it returns 404 in production
   - Add HMAC request signing for admin operations

3. **Dead Code Cleanup**:
   - Delete `apps/` directory (empty Bun scaffold)
   - Delete `platform/` directory (empty)
   - Delete `projects/` directory (stale experiments)
   - Delete `infra/k8s/` directory (empty)
   - Move `crates/` to `archive/crates/` (116MB Rust monorepo, dead)
   - Remove Rust `backend` service from docker-compose.yml (if still referenced)

4. **README.md Rewrite** — Current README likely references CapexCycleOS. Rewrite to reflect CerniQ ALM positioning using `docs/CERNIQ_MASTER_PLAYBOOK.md` §1 as source.

5. **API Versioning Consistency** — Several controllers lack `/api/v1/` prefix. Audit and standardize:
   - `billing.controller.ts` — no prefix
   - `leads.controller.ts` — no prefix
   - `pipeline.controller.ts` — no prefix
   - `app.controller.ts` — root controller, bare health endpoints

6. **Test Coverage** — Run `cd backend-node && npm test` and fix any failing tests. Add missing tests for untested services.

7. **Frontend Auth Unification** — The dual token storage (sessionStorage + HttpOnly cookies) creates race conditions. Standardize to HttpOnly cookies only. This touches:
   - `frontend/lib/api.ts` (token get/set/clear functions)
   - `frontend/lib/store.ts` (hydrateFromStorage)
   - `backend-node/src/auth/auth.guard.ts` (token extraction)

### Rules:
- Check this file before starting work
- Update the "Currently Working On" section for your terminal
- Do NOT touch files listed in another terminal's "Files Being Touched" section
- Commit independently — don't wait for the other terminal
