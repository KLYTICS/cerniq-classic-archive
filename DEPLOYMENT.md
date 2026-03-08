# CERNIQ Deployment Guide (Vercel + Railway)

## Target Production Topology

```
[ Vercel ] cerniq.io / www.cerniq.io  --->  [ Railway ] api.cerniq.io
                 Next.js frontend                    NestJS backend
```

## Domain Best Practices

- Use `cerniq.io` as canonical primary domain.
- Redirect `www.cerniq.io` -> `cerniq.io` (handled by Vercel domain redirect).
- Put API on subdomain `api.cerniq.io` (keeps cookies/security boundaries cleaner).
- Keep preview deployments on `*.vercel.app` for testing only.

## DNS Setup

Configure these records at your DNS provider:

| Type | Host | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` (Vercel apex) |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `api` | `<your-railway-service>.up.railway.app` |

Notes:
- Replace `<your-railway-service>.up.railway.app` with your real Railway generated domain.
- Keep TTL at `300` while migrating, then raise to `3600`.

## Vercel Setup (Frontend)

1. Link/import the frontend project (`frontend/`) to Vercel.
2. Add domains in project settings:
   - `cerniq.io`
   - `www.cerniq.io`
3. Set production environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://cerniq.io
NEXT_PUBLIC_NODE_API_URL=https://api.cerniq.io
```

4. Redeploy production after env updates (public vars are build-time in Next.js).

## Railway Setup (Backend)

1. Deploy `backend-node/` service on Railway.
2. Add custom domain `api.cerniq.io` to the backend service.
3. Set required production variables:

```bash
NODE_ENV=production
JWT_SECRET=<32+ chars>
DATABASE_URL=<railway postgres url>
FRONTEND_URL=https://cerniq.io
ALLOWED_ORIGINS=https://cerniq.io,https://www.cerniq.io
KLYTICS_APP_ID=cerniq
```

4. Optional OAuth variables:

```bash
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
GITHUB_CALLBACK_URL=https://api.cerniq.io/api/auth/github/callback

GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_CALLBACK_URL=https://api.cerniq.io/api/auth/google/callback
```

## OAuth App Configuration

For GitHub OAuth App:
- Homepage URL: `https://cerniq.io`
- Authorization callback URL: `https://api.cerniq.io/api/auth/github/callback`

For Google OAuth:
- Authorized JavaScript origins: `https://cerniq.io`
- Authorized redirect URI: `https://api.cerniq.io/api/auth/google/callback`

## Verification Checklist

- Frontend loads at `https://cerniq.io`
- `https://api.cerniq.io/health` returns healthy/degraded JSON (not 404)
- Login page OAuth buttons point to `https://api.cerniq.io/api/auth/...`
- Demo request submits successfully (no localhost calls)
- Admin page and status page load with API connectivity
- CORS allows `https://cerniq.io` and `https://www.cerniq.io`

## Quick Smoke Tests

```bash
curl -i https://api.cerniq.io/health
curl -i https://cerniq.io/status
curl -i https://cerniq.io/login
```

## Rollback Plan

- Keep previous `*.vercel.app` production deployment available until DNS stabilizes.
- If issues occur, temporarily point `NEXT_PUBLIC_NODE_API_URL` back to last known-good API URL and redeploy frontend.
- Keep Railway service URL active even after custom domain cutover.
