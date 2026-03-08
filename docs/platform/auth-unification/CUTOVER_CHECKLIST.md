# Cutover Checklist

- [x] Backend accepts Supabase JWT (JWKS preferred, HS256 fallback)
- [x] /auth/whoami exists and is protected
- [x] Frontend sends bearer token to APIs (Supabase session token path)
- [x] Org membership checks enforced in production (`KLYTICS_REQUIRE_ORG=true`)
- [x] App entitlement checks enforced in production (`KLYTICS_REQUIRE_ENTITLEMENT=true`)
- [x] Legacy auth disabled in production (`AUTH_ALLOW_LEGACY=false`)
- [x] CI/Unit auth tests passing for verifier module
- [ ] Secret scanning passing
