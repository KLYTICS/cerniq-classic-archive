# UptimeRobot — CERNIQ Production Monitors

Free tier (50 monitors, 5-min intervals) is plenty for CERNIQ's surface area.
This doc is a **paste-ready runbook**: every field below is literal.

## One-time setup (Erwin, ~10 min)

1. Sign up at https://uptimerobot.com using `erwin@cerniq.io` (or `eskiessalfonso@gmail.com`).
2. Enable 2FA on the account (Settings → My Settings → Two-Factor Auth).
3. Create an **Alert Contact** of type *Email* → `erwin@cerniq.io`.
4. Create a second alert contact of type *Slack webhook* if you want #incidents pings (optional).
5. Add each monitor in the table below (New Monitor → HTTP(s) → paste URL → pick contacts).
6. Run the pre-flight check first: `scripts/ops/verify-uptime-endpoints.sh`.

## Monitors to create

| # | Name                         | Type      | URL                                                     | Interval | Expected                         |
|---|------------------------------|-----------|---------------------------------------------------------|----------|----------------------------------|
| 1 | CERNIQ · frontend · /        | HTTP(s)   | `https://cerniq.io/`                                    | 5 min    | 200, keyword `CERNIQ`            |
| 2 | CERNIQ · frontend · health   | Keyword   | `https://cerniq.io/api/health`                          | 5 min    | 200, keyword `healthy`           |
| 3 | CERNIQ · api · health        | Keyword   | `https://api.cerniq.io/health`                          | 5 min    | 200, keyword `"status":"healthy"` (or `degraded` — see §Sensitivity) |
| 4 | CERNIQ · api · ready         | HTTP(s)   | `https://api.cerniq.io/ready`                           | 5 min    | 200 only (503 during shutdown)   |
| 5 | CERNIQ · api · live          | HTTP(s)   | `https://api.cerniq.io/health/live`                     | 5 min    | 200                              |
| 6 | CERNIQ · stripe webhook      | Keyword   | `https://api.cerniq.io/api/billing/webhook/healthcheck` | 15 min   | 200, keyword `stripe-webhook`    |
| 7 | CERNIQ · cert expiry · root  | SSL       | `https://cerniq.io`                                     | daily    | alert at ≤ 14 days               |
| 8 | CERNIQ · cert expiry · api   | SSL       | `https://api.cerniq.io`                                 | daily    | alert at ≤ 14 days               |
| 9 | CERNIQ · domain expiry       | Domain    | `cerniq.io`                                             | daily    | alert at ≤ 30 days               |
| 10| CERNIQ · portal              | Keyword   | `https://cerniq.io/portal`                              | 5 min    | 200, keyword `portal`            |

**Sensitivity (alerting):** set *alert after 2 failed checks* (10 min) on all HTTP monitors
so a single transient network blip doesn't page you. SSL + Domain monitors alert immediately.

### §Sensitivity — `/health` "degraded"
The backend `/health` endpoint returns 200 with `"status":"degraded"` when Redis is unreachable
but the DB is up. If you want to *alert* on degraded, use keyword `"status":"healthy"` (strict).
If you prefer "only alert when the API is fully down," use keyword `"api":"up"` (lenient).
Default recommendation: **strict** — degraded is worth an email but not a page.

## Status page (public)

UptimeRobot gives you a free public status page. Recommended:

1. Status Pages → Add Status Page
2. Name: `CERNIQ Status`
3. Custom domain: `status.cerniq.io` (add CNAME `status` → `stats.uptimerobot.com` in Spaceship)
4. Monitors to include: 1, 2, 3, 10 (the user-visible ones; skip internal `/ready`, `/live`)
5. Link it from `https://cerniq.io/security` and the footer.

## Cost-of-ownership

Free tier covers everything above. Upgrade to Pro ($7/mo) only when you need:
- 1-min intervals (P1 SLA commitment)
- SMS/voice alerts (vs email+slack)
- Maintenance windows tied to deploys

## Verification

Before creating monitors, run the pre-flight:

```bash
scripts/ops/verify-uptime-endpoints.sh
```

It hits every URL above and asserts the status code + keyword match UptimeRobot will enforce.
Exit 0 = safe to wire up the monitors.
