## Learned User Preferences

- Prefers enterprise-quality, end-to-end, production-demoable work; often asks to continue until the full ladder is closed rather than stopping at partial bring-up.
- Claude Code is the main engineer; Cursor sessions should leave reproducible handoffs and explicit artifacts Claude Code can pick up.
- Interactive `railway login` and pasting OAuth/client secrets are founder-run; agents should stage non-interactive scripts and checklists around that.
- Prefer finishing Supabase auth unification over adding Clerk for this project.
- Do not edit attached plan files when implementing from a plan; use existing todos rather than recreating them.
- GTM target is all 91 COSSEC-insured PR cooperativas for pitching — CRM registry plus optional product ALM shells, never fabricated balance sheets.

## Learned Workspace Facts

- Google Sign-In is Nest/Passport on `api.cerniq.io`; set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Railway only (never `NEXT_PUBLIC_*`); callback is `https://api.cerniq.io/api/auth/google/callback`.
- Missing Google OAuth env fails closed with HTTP 503 (not a `not-configured` redirect); bring-up via `docs/ops/GOOGLE_OAUTH_BRINGUP.md` and `scripts/ops/google-oauth-bringup.sh`.
- Cross-subdomain auth cookies use `AUTH_COOKIE_DOMAIN=.cerniq.io` with `FRONTEND_URL=https://cerniq.io`; never set `AUTH_COOKIE_SAMESITE=lax` in production (BUG-001 breaks cerniq.io ↔ api.cerniq.io).
- Production `DATABASE_URL` uses Railway private networking; run Prisma migrate status/deploy via `railway ssh`, not from the laptop.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_*` belong on Vercel (frontend), not Railway API env.
- Authoritative coop registry: 91 rows in `backend-node/src/alm/data/registry/pr-cooperativas-q2-2025.json` (COSSEC Anejo 9); ICP tiers tier1 ≥$100M, tier2 $50–100M, tier3 <$50M; exclude dissolved Aguada.
- Pickup hub is `docs/SESSION_HANDOFF.md`; multi-session coordination uses `claude-peers` with explicit pathspec commits.
