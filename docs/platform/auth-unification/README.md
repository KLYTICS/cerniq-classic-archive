# Auth Unification (NestJS + Next.js)

> **Stack of record:** NestJS (`backend-node`) + Next.js (`frontend`).  
> Historical Rust references (`verify_supabase.rs`) are obsolete — do not revive them.

## Goal

Single identity path: **Supabase-issued session JWTs** verified by Nest, mapped to Prisma `User` + workspace tenancy. Nest HS256 cookies remain during migration behind `AUTH_ALLOW_LEGACY`.

## Phases

| Phase | Status | Scope |
|---|---|---|
| **1 — Backend accept** | Done | `AuthGuard` verifies Supabase tokens; `resolveApplicationUser`; `GET /api/auth/whoami`; WS parity |
| **2 — Frontend session** | In progress | Supabase client when `NEXT_PUBLIC_SUPABASE_*` set; bearer sync; Nest fallback when unset |
| **3 — Verify harden** | In progress | Local JWKS/HS256 verify (no per-request `/auth/v1/user` dependency); env schema; prod `KLYTICS_*` flags |
| **4 — Legacy sunset** | Pending | Clients on Supabase only; `AUTH_ALLOW_LEGACY=false` in prod; retire Nest password mint for new sessions |

## Canonical paths

| Concern | File |
|---|---|
| HTTP verify + org gate | `backend-node/src/auth/auth.guard.ts` |
| JWKS / HS256 util | `backend-node/src/auth/supabase-jwt.util.ts` |
| User provisioning | `backend-node/src/auth/auth.service.ts` |
| Whoami | `GET /api/auth/whoami` |
| Frontend Supabase client | `frontend/lib/supabase/client.ts` |
| Login entry | `frontend/app/login/page.tsx` |
| Env contract | [ENV_CONTRACT.md](./ENV_CONTRACT.md) |
| Cutover | [CUTOVER_CHECKLIST.md](./CUTOVER_CHECKLIST.md) |
| Legacy sunset | [docs/security/LEGACY_JWT_SUNSET.md](../../security/LEGACY_JWT_SUNSET.md) |

## What Supabase does **not** replace

Institution `Workspace` tenancy, `InstitutionScopeGuard`, 9-role RBAC, Stripe `PlatformAccessService`, API keys, portal demo magic-link, audit stamps.

## Verification

```bash
# Backend unit coverage
cd backend-node && npx jest src/auth/supabase-jwt.util.spec.ts src/auth/auth.guard.spec.ts

# Local with Supabase project configured
# set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_* server vars
# then login at /login → Bearer reaches Nest → GET /api/auth/whoami
```
