# Cutover Checklist

## Phase 1 — Backend accept
- [x] Backend accepts Supabase JWT (HTTP introspection + local JWKS/HS256 when configured)
- [x] `GET /api/auth/whoami` exists and is protected
- [x] Org membership checks coded (`KLYTICS_REQUIRE_ORG`)
- [x] App entitlement checks coded (`KLYTICS_REQUIRE_ENTITLEMENT`)
- [x] Auth unit tests for verifier path

## Phase 2 — Frontend session
- [x] `@supabase/supabase-js` installed
- [x] Browser client + session helpers behind `NEXT_PUBLIC_SUPABASE_*`
- [x] Login uses Supabase `signInWithPassword` when public env set (Nest fallback otherwise)
- [x] API client prefers Supabase access token for `Authorization: Bearer`
- [ ] Production E2E with real Supabase JWT in `.env.production-e2e.local`

## Phase 3 — Verify harden
- [x] `supabase-jwt.util.ts` — JWKS preferred, HS256 fallback, HTTP user introspect last
- [x] `env.schema.ts` declares `SUPABASE_ANON_KEY`, JWKS/issuer/audience, `AUTH_ALLOW_LEGACY`, `KLYTICS_*`
- [ ] Railway prod: `AUTH_ALLOW_LEGACY=false`, `KLYTICS_REQUIRE_ORG=true`, JWKS URL set
- [ ] Frontend sends `x-organization-id` when multi-org users exist

## Phase 4 — Legacy sunset
- [ ] All web clients use Supabase session (see LEGACY_JWT_SUNSET.md)
- [ ] Nest password login gated or proxied to Supabase Admin
- [ ] `AUTH_LEGACY_DEPRECATION_WARN=1` telemetry quiet
- [ ] Remove legacy Nest JWT mint for new sessions

## Ops
- [ ] Secret scanning clean on auth commits
- [ ] `AUTH_ALLOW_LEGACY=false` confirmed in Railway (not just code default)
