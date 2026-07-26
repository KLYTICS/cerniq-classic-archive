# Legacy JWT deprecation — single canonical identity

## Canonical path

- **Production identity:** Supabase-issued bearer tokens validated via [`verifySupabaseToken`](../../backend-node/src/auth/auth.guard.ts) (with application user resolved in Postgres).

## Legacy path

- **Legacy Nest HS256 JWTs** validated via [`verifyLegacyToken`](../../backend-node/src/auth/auth.guard.ts), gated by JWT `type` (`access`/`refresh`) and **`AUTH_ALLOW_LEGACY`** environment variable (`1`/`true`/`yes`/`on` to allow fallback).

## Operational controls

Two independent switches govern the two halves of the legacy lifecycle — **verification** of already-issued tokens, and **issuance** (minting) of new ones. Sunset the mint first (clients stop getting new legacy sessions), then, once no live legacy sessions remain, tighten verification.

1. **`AUTH_ALLOW_LEGACY`** *(verification)* — Keep **unset/false** in production once all clients migrate; enables strict Supabase-only verification except for deliberate `refresh`/`access` typed legacy tokens handled first in the pipeline.
2. **`AUTH_DISABLE_LEGACY_MINT`** *(issuance — Phase 4)* — When truthy (`1`/`true`/`yes`/`on`), the Nest password mint refuses to issue new legacy HS256 sessions: `register`, `login`, and `refreshTokens` all return **`410 Gone`** ("authenticate via Supabase session tokens") at the single [`generateTokens`](../../backend-node/src/auth/auth.service.ts) chokepoint. **Unset (default) preserves current behavior** — flip to `true` only after Supabase login (incl. the master account) is verified live in prod. Issuance-only: it does **not** affect verification of existing tokens (that is `AUTH_ALLOW_LEGACY`). OAuth callbacks do **not** route through `generateTokens`, so they are unaffected.
3. **Deprecation signaling** — When `AUTH_LEGACY_DEPRECATION_WARN=1`, successful responses authenticated by legacy verifier emit **`Deprecation: jwt-legacy`** and **`Sunset: 2026-12-31`** (RFC 9745 style) headers for client observability.

## Retirement checklist

- [ ] All web and mobile clients use Supabase session or equivalent.
- [ ] Service accounts migrated to hashed API keys or OIDC confidential clients where appropriate.
- [ ] **Set `AUTH_DISABLE_LEGACY_MINT=true` in prod** once Supabase login is verified — stops new legacy sessions while existing ones drain.
- [ ] After the legacy refresh window (max 7 days) elapses with the mint disabled, set `AUTH_ALLOW_LEGACY=false`.
- [ ] Remove legacy signing keys from KMS/Secrets manager after cutoff.
- [ ] Delete `AUTH_ALLOW_LEGACY` allowance in prod.
