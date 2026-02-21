# CapexCycleOS Deployment Guide

## Architecture

```
[Vercel - Frontend]  ──HTTPS──>  [Fly.io - Backend]  ──>  [Fly Postgres]
     Next.js 15                     NestJS + Prisma         PostgreSQL 16
   capexcycle.vercel.app          capexcycleos-api.fly.dev
```

## Backend (Fly.io)

### Service: `capexcycleos-api`

**Build:** Docker multi-stage (node:20-alpine)
**Start:** `npx prisma migrate deploy && node dist/src/main.js`
**Region:** `iad` (Ashburn, Virginia)

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` (auto-attached) |
| `JWT_SECRET` | Min 32 chars, used for JWT signing | `your-secret-key-at-least-32-chars` |
| `NODE_ENV` | Must be `production` | `production` |
| `FRONTEND_URL` | Vercel deployment URL | `https://capexcycle.vercel.app` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection (graceful degradation) | none |
| `ALLOWED_ORIGINS` | Additional CORS origins (comma-separated) | none |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | none |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | none |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | none |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | none |
| `SUPABASE_URL` | Supabase project URL (optional ticker service) | none |
| `SUPABASE_KEY` | Supabase anon key | none |

### Setup Steps

1. Install Fly CLI: `brew install flyctl`
2. Login: `fly auth login`
3. Create app: `fly apps create capexcycleos-api`
4. Create Postgres: `fly postgres create --name capexcycleos-db --region iad`
5. Attach DB: `fly postgres attach capexcycleos-db --app capexcycleos-api`
6. Set secrets:
   ```bash
   fly secrets set JWT_SECRET="your-secret-min-32-chars" \
     NODE_ENV=production \
     FRONTEND_URL=https://capexcycle.vercel.app \
     --app capexcycleos-api
   ```
7. Deploy: `fly deploy --app capexcycleos-api` (from `backend-node/`)
8. Health check: `curl https://capexcycleos-api.fly.dev/health`

### Redeploying

```bash
cd backend-node
fly deploy
```

---

## Frontend (Vercel)

### Service: Next.js frontend

**Framework:** Auto-detected as Next.js
**Build:** `npm run build`
**Output:** `.next`
**Root Directory:** `frontend`

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_NODE_API_URL` | Fly.io backend URL | `https://capexcycleos-api.fly.dev` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SEGMENT_WRITE_KEY` | Segment analytics key | none |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 ID | none |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key | none |

### Setup Steps

1. Import repository to Vercel
2. Set root directory to `frontend`
3. Set `NEXT_PUBLIC_NODE_API_URL` to `https://capexcycleos-api.fly.dev`
4. Deploy

### CLI Deploy

```bash
cd frontend
vercel --prod --yes
```

---

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://capexcycle.vercel.app |
| Backend API | https://capexcycleos-api.fly.dev |
| Health Check | https://capexcycleos-api.fly.dev/health |
| Status Page | https://capexcycle.vercel.app/status |
| Admin Dashboard | https://capexcycle.vercel.app/admin |
| Demo Deep Link | https://capexcycle.vercel.app/demo |

---

## Post-Deploy Checklist

- [ ] Backend health check returns healthy: `curl https://capexcycleos-api.fly.dev/health`
- [ ] Frontend loads at Vercel URL
- [ ] Registration works (creates user with bcrypt hash)
- [ ] Login sets HttpOnly cookies (not visible in `document.cookie`)
- [ ] ALM demo data seeds via onboarding flow
- [ ] PDF report downloads successfully
- [ ] CORS allows frontend origin (check Network tab for preflight)
- [ ] Status page shows API and DB as "up"

## Custom Domain

To use `capexcycleos.com`:
1. Add CNAME record pointing to Vercel
2. Add domain in Vercel project settings
3. Update `FRONTEND_URL` on Fly.io: `fly secrets set FRONTEND_URL=https://capexcycleos.com --app capexcycleos-api`
4. The CORS config already allows `*.capexcycleos.com`

## Troubleshooting

**CORS errors:** Ensure `FRONTEND_URL` on Fly.io matches the exact Vercel URL (including `https://`). The backend also allows `*.vercel.app`, `*.fly.dev`, and `*.capexcycleos.com`.

**Cookie not set:** In production, cookies use `SameSite=None; Secure=true`. Both frontend and backend must use HTTPS.

**Prisma migration fails:** Check `DATABASE_URL` is correct. Run `fly postgres connect --app capexcycleos-db` to verify connectivity.

**502 on Fly.io:** Check logs with `fly logs --app capexcycleos-api`. Likely a missing env var (`JWT_SECRET` or `DATABASE_URL`). The server exits with a clear error message.

**Cache degraded:** Expected if no Redis is provisioned. The app runs fully without Redis — cache just returns misses.
