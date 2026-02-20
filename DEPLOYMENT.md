# CapexCycleOS Deployment Guide

## Architecture

```
[Vercel - Frontend]  ──HTTPS──>  [Railway - Backend]  ──>  [Railway PostgreSQL]
     Next.js 15                     NestJS + Prisma            PostgreSQL 15
```

## Backend (Railway)

### Service: `backend-node`

**Build:** Nixpacks (auto-detected)
**Start:** `npx prisma migrate deploy && node dist/main.js`

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Min 32 chars, used for JWT signing | `your-secret-key-at-least-32-chars` |
| `NODE_ENV` | Must be `production` | `production` |
| `FRONTEND_URL` | Vercel deployment URL | `https://capexcycleos.vercel.app` |
| `PORT` | Railway sets this automatically | (auto) |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection (graceful degradation) | none |
| `ALLOWED_ORIGINS` | Additional CORS origins (comma-separated) | none |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | none |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | none |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | none |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | none |

### Setup Steps

1. Create a new Railway project
2. Add a PostgreSQL service
3. Add a new service from the `backend-node` directory
4. Set all required env vars (Railway auto-provides `DATABASE_URL` if linked)
5. Deploy — Railway runs `prisma migrate deploy` then starts the server
6. Health check: `GET /health` should return `{"status": "healthy"}`

---

## Frontend (Vercel)

### Service: Next.js frontend

**Framework:** Auto-detected as Next.js
**Build:** `npm run build`
**Output:** `.next`

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_NODE_API_URL` | Railway backend URL | `https://your-backend.railway.app` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SEGMENT_WRITE_KEY` | Segment analytics key | none |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 ID | none |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key | none |

### Setup Steps

1. Import repository to Vercel
2. Set root directory to `frontend`
3. Set `NEXT_PUBLIC_NODE_API_URL` to the Railway backend URL
4. Deploy

---

## Post-Deploy Checklist

- [ ] Backend health check returns healthy: `curl https://<backend>.railway.app/health`
- [ ] Frontend loads at Vercel URL
- [ ] Registration works (creates user with bcrypt hash)
- [ ] Login sets HttpOnly cookies (not visible in `document.cookie`)
- [ ] ALM demo data seeds via onboarding flow
- [ ] PDF report downloads successfully
- [ ] CORS allows frontend origin (check Network tab for preflight)

## Custom Domain

To use `capexcycleos.com`:
1. Add CNAME record pointing to Vercel
2. Add domain in Vercel project settings
3. Update `FRONTEND_URL` on Railway to match
4. The CORS config already allows `*.capexcycleos.com`

## Troubleshooting

**CORS errors:** Ensure `FRONTEND_URL` on Railway matches the exact Vercel URL (including `https://`).

**Cookie not set:** In production, cookies use `SameSite=None; Secure=true`. Both frontend and backend must use HTTPS.

**Prisma migration fails:** Check `DATABASE_URL` is correct and the DB is accessible from Railway's network.

**502 on Railway:** Check logs — likely a missing env var (`JWT_SECRET` or `DATABASE_URL`). The server exits with a clear error message.
