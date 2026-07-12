# Env Contract

## Client
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Server
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_JWKS_URL
- SUPABASE_JWT_ISSUER
- SUPABASE_JWT_AUDIENCE
- SUPABASE_JWT_SECRET (legacy fallback only)

## App
- KLYTICS_APP_ID=cerniq
- KLYTICS_REQUIRE_ORG
- KLYTICS_REQUIRE_ENTITLEMENT

## Backward Compatibility
- AUTH_ALLOW_LEGACY=true|false  (code default: false when unset)
- AUTH_LEGACY_DEPRECATION_WARN=true|false

## Production cutover flags
- AUTH_ALLOW_LEGACY=false
- KLYTICS_REQUIRE_ORG=true
- KLYTICS_REQUIRE_ENTITLEMENT=true
- SUPABASE_JWKS_URL=https://<project>.supabase.co/auth/v1/.well-known/jwks.json
