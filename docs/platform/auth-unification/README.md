# Auth Unification

## Before
- Mixed auth state with legacy bypass behavior in frontend and custom JWT middleware in Rust backend.
- Backend accepted bearer JWT and legacy `x-user-id` headers unconditionally.

## After
- Canonical Supabase verification module added:
  - `backend/src/auth/verify_supabase.rs`
- Backend auth middleware now verifies Supabase tokens first and only allows legacy header fallback when `AUTH_ALLOW_LEGACY=true`.
- Protected introspection endpoint added:
  - `GET /auth/whoami`
- Frontend login/session flow now uses Supabase auth REST endpoints when public Supabase env is configured.

## Current Phase
- Phase 1: in progress (backend acceptance delivered)
- Phase 2: in progress (frontend wiring baseline delivered)
- Phase 3: pending
- Phase 4: pending
