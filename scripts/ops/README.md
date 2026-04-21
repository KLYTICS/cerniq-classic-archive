# scripts/ops — Production Operations

Scripts for hand-run operational tasks. Each script is idempotent,
defaults to dry-run where destructive, and fails loudly (rather than
silently) when misconfigured.

| Script                          | Purpose                                                   | Destructive? | Runtime |
|---------------------------------|-----------------------------------------------------------|:------------:|:-------:|
| `railway-bootstrap-prod.sh`     | Generate `DATA_ENCRYPTION_KEY` + set Stripe live keys     | ✱ on `--apply` | 2-3 min |
| `railway-verify-prod.sh`        | Confirm every required env var exists + well-shaped       | no           | 10 sec  |
| `verify-uptime-endpoints.sh`    | Pre-flight: all UptimeRobot targets return 200 + keyword  | no           | 30 sec  |
| `verify-resend-dns.sh`          | `dig`-check SPF, DKIM, MX, DMARC (+ strict alignment)     | no           | 15 sec  |
| `verify-security-headers.sh`    | HSTS / CSP / X-Frame / Permissions-Policy regression test | no           | 10 sec  |
| `verify-dpa-purge.sh`           | Prove the 90-day PII purge is actually firing in prod     | no (read-only) | 20 sec  |
| `git-history-cleanup.sh`        | Rewrite history to drop `archive/`, `crates/`, etc.       | ✱ push step  | ~5 min  |

## End-to-end execution order (recommended)

Run these in order for a fresh production launch. Each step gates the next.

### 1 · Backend env → green

```bash
scripts/ops/railway-bootstrap-prod.sh            # dry-run; review output
scripts/ops/railway-bootstrap-prod.sh --apply    # set DATA_ENCRYPTION_KEY + Stripe keys
scripts/ops/railway-verify-prod.sh               # confirm every var present + shaped
```

On green, back up the just-generated `DATA_ENCRYPTION_KEY` to 1Password.
Losing it orphans every encrypted `report_jobs.raw_data` row — see
[`docs/ops/SECRETS_ROTATION.md`](../../docs/ops/SECRETS_ROTATION.md).

### 2 · Email deliverability

Follow [`docs/ops/resend_dns_setup.md`](../../docs/ops/resend_dns_setup.md)
for the DNS records, then:

```bash
scripts/ops/verify-resend-dns.sh                 # poll until green (DNS propagation ~2-15 min)
```

**Before the DMARC record goes live**, set up the monitoring inbox per
[`docs/ops/dmarc_inbox_setup.md`](../../docs/ops/dmarc_inbox_setup.md)
(recommend Option B — Postmark aggregator). A DMARC record without a
real `rua=` target is compliance theater.

### 3 · Uptime monitors

Follow [`docs/ops/uptimerobot_setup.md`](../../docs/ops/uptimerobot_setup.md).
Run the pre-flight first:

```bash
scripts/ops/verify-uptime-endpoints.sh           # all 7 targets + SSL expiry
```

Create the 10 monitors in the UptimeRobot dashboard; point the public
status page at `status.cerniq.io`.

### 4 · A11y baseline

Sweep infrastructure lives at `frontend/e2e/a11y-sweep/`. First run captures
the starting-point baseline + ratchet:

```bash
cd frontend
npm install                                       # pulls @axe-core/playwright
npm run a11y:routes                              # discover all 170 routes

export A11Y_SWEEP_EMAIL=data.ai.kiess@gmail.com
export A11Y_SWEEP_PASSWORD=$MASTER_ACCOUNT_PASSWORD
npm run a11y:baseline                             # writes baseline.json + ratchet.json

git add e2e/a11y-sweep/baseline.json e2e/a11y-sweep/ratchet.json
git commit -m "a11y: initial sweep baseline"
```

Then add GitHub Actions secrets (`Settings → Secrets → Actions`):

- `A11Y_SWEEP_EMAIL`
- `A11Y_SWEEP_PASSWORD`

CI will sweep every PR touching `frontend/**`, and a weekly scheduled
run hits production every Monday 09:00 AST.

### 5 · Monthly compliance evidence (for bank procurement)

Run these monthly. Save the green output as evidence for security
questionnaires — every fintech buyer will ask for one of these.

```bash
scripts/ops/verify-security-headers.sh           # HSTS / CSP / CORS still enforced
scripts/ops/verify-dpa-purge.sh                  # 90-day PII purge actually firing
scripts/ops/verify-resend-dns.sh                 # SPF/DKIM/DMARC still green
scripts/ops/railway-verify-prod.sh               # no env drift
```

CI already enforces most of this on every PR. This is the "show the
bank a screenshot" pass.

### 6 · Git hygiene (do last — invalidates open PRs)

```bash
scripts/ops/git-history-cleanup.sh               # operates on a throwaway mirror
# Review the size delta it prints, then follow the "NEXT STEPS"
# block at the bottom of the output to actually push.
```

5.7 GB of Rust build artifacts will leave the pack; typical final `.git`
size drops from ~700 MB to ~120 MB.

## Related docs

All the paste-ready runbooks live under `docs/ops/`:

| Doc                                                   | Covers                                   |
|-------------------------------------------------------|------------------------------------------|
| [`railway_env_vars.md`](../../docs/ops/railway_env_vars.md) | Full env var reference + DPA encryption notes |
| [`SECRETS_ROTATION.md`](../../docs/ops/SECRETS_ROTATION.md) | Cadence + procedure for every long-lived secret |
| [`uptimerobot_setup.md`](../../docs/ops/uptimerobot_setup.md) | Monitor table + status page setup |
| [`resend_dns_setup.md`](../../docs/ops/resend_dns_setup.md)   | SPF / DKIM / MX / DMARC records + ramp plan |
| [`dmarc_inbox_setup.md`](../../docs/ops/dmarc_inbox_setup.md) | `dmarc@cerniq.io` inbox prereq         |
| [`deployment_runbook.md`](../../docs/ops/deployment_runbook.md) | RAILWAY_TOKEN rotation (canonical)   |
| [`INCIDENT_RUNBOOK.md`](../../docs/ops/INCIDENT_RUNBOOK.md) | Sev-1/2/3 response procedures          |
| [`disaster_recovery.md`](../../docs/ops/disaster_recovery.md) | Backup + restore                        |

## CI workflows (separate from scripts/ops)

| Workflow                                     | Fires                      | Purpose                                    |
|----------------------------------------------|----------------------------|--------------------------------------------|
| `.github/workflows/ci.yml`                   | every PR                   | Fast typecheck + lint pass                 |
| `.github/workflows/ci-cd.yml`                | every PR + push to main    | Full test suite + HIGH+ CVE gate (prod deps) |
| `.github/workflows/a11y-sweep.yml`           | frontend PRs + Mon 13:00 UTC | WCAG 2.1 AA sweep + ratchet             |
| `.github/workflows/secrets-scan.yml`         | every PR + daily 08:30 UTC | gitleaks (CERNIQ + default rules)          |
| `.github/workflows/sbom-and-audit.yml`       | Mon 14:00 UTC + on lock changes | CycloneDX SBOM + extended audit (incl. dev) |
| `.github/workflows/codeql.yml`               | every PR                   | Static analysis (existing)                 |

## A11y workflow

Everything under `frontend/e2e/a11y-sweep/`. See the README there.

| Command                         | Purpose                                      |
|---------------------------------|----------------------------------------------|
| `npm run a11y:routes`           | Regenerate the route inventory               |
| `npm run a11y:sweep`            | Full sweep (public + authed)                 |
| `npm run a11y:sweep:public`     | Public only (141 routes, no auth needed)    |
| `npm run a11y:sweep:authed`     | Authed only (23 routes, requires creds)     |
| `npm run a11y:baseline`         | Lock current violations as baseline + ratchet |
| `npm run a11y:report`           | Render Markdown report of latest run        |

CI: `.github/workflows/a11y-sweep.yml`
  - Every `frontend/**` PR → local sweep + PR comment
  - Weekly Monday 13:00 UTC → production sweep (public only)
  - Manual `workflow_dispatch` → choose local or production

## Principles

- **Dry-run first** — the bootstrap + cleanup scripts refuse to mutate
  state without an explicit `--apply` flag or manual next-steps.
- **No secret-echo** — `railway-verify-prod.sh` reports length and shape,
  never the value.
- **Verify-after-every-step** — every destructive step has a companion
  verifier that exits non-zero when the invariant breaks.
- **Fail loudly** — scripts print which specific target broke and how
  to fix it, rather than a generic "something failed."
