# Legacy JWT deprecation — single canonical identity

## Canonical path

- **Production identity:** Supabase-issued bearer tokens validated via [`verifySupabaseToken`](../../backend-node/src/auth/auth.guard.ts) (with application user resolved in Postgres).

## Legacy path

- **Legacy Nest HS256 JWTs** validated via [`verifyLegacyToken`](../../backend-node/src/auth/auth.guard.ts), gated by JWT `type` (`access`/`refresh`) and **`AUTH_ALLOW_LEGACY`** environment variable (`1`/`true`/`yes`/`on` to allow fallback).

## Operational controls

1. **`AUTH_ALLOW_LEGACY`** — Keep **unset/false** in production once all clients migrate; enables strict Supabase-only verification except for deliberate `refresh`/`access` typed legacy tokens handled first in the pipeline.
2. **Deprecation signaling** — When `AUTH_LEGACY_DEPRECATION_WARN=1`, successful responses authenticated by legacy verifier emit **`Deprecation: jwt-legacy`** and **`Sunset: 2026-12-31`** (RFC 9745 style) headers for client observability.

## Retirement checklist

- [ ] All web and mobile clients use Supabase session or equivalent.
- [ ] Service accounts migrated to hashed API keys or OIDC confidential clients where appropriate.
- [ ] Remove legacy signing keys from KMS/Secrets manager after cutoff.
- [ ] Delete `AUTH_ALLOW_LEGACY` allowance in prod.
