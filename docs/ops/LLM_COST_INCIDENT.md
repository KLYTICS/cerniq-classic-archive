# LLM Cost Cap Incident Runbook

**Version:** 1.0
**Date:** 2026-04-17
**Audience:** On-call engineer, Erwin
**SLA:** Triage within 15 min of OK→WARN transition, within 5 min of BLOCKED

The `AgentCostCircuitBreakerService` enforces month-to-date LLM spend
per institution. This runbook covers the three states the system can
enter, what each means, and the 3-step triage for each.

## 🚦 State definitions

| State | Trigger | Agent behavior | UI |
|---|---|---|---|
| `OK` | spend < 80% of `LLM_COST_CAP_USD_CENTS` | Runs proceed normally | — |
| `WARN` | 80% ≤ spend < 100% | Runs proceed | Amber "Approaching budget cap" banner |
| `BLOCKED` | spend ≥ 100% | New runs rejected with `BUDGET_EXCEEDED` | Red banner + "Contact admin" |

Spend is tracked per-institution in `agent_runs.cost_usd_cents`, summed
over the current calendar month (UTC). Cap is `LLM_COST_CAP_USD_CENTS`
env var, default 10000 ($100). Per-institution cap can be overridden
via the `Institution.llmCostCapUsdCents` column (TODO: not yet exposed).

## 🟡 OK → WARN transition

**Detection:** Sentry alert on first run per institution that resolves
to state=WARN. Email alert to erwin@cerniq.io via Resend.

**3-step triage:**

1. **Verify signal.** Query the cost rollup directly:
   ```bash
   curl -H "x-admin-key: $ADMIN_KEY" \
     "https://api.cerniq.io/api/v1/agents/<institutionId>/cost"
   # Expect: {"monthToDate": {...}, "breakdown": [...], "state": "WARN",
   #          "remainingUsdCents": <remaining>}
   ```
   Confirm `state === "WARN"` and `remainingUsdCents > 0`.

2. **Classify cause.** Query recent high-cost runs:
   ```sql
   SELECT agent_id, SUM(cost_usd_cents) / 100.0 AS usd,
          COUNT(*) AS runs,
          date_trunc('day', created_at) AS day
   FROM agent_runs
   WHERE institution_id = '<institutionId>'
     AND created_at >= date_trunc('month', now())
     AND status = 'SUCCEEDED'
   GROUP BY agent_id, day
   ORDER BY usd DESC LIMIT 10;
   ```
   - **If one agent dominates (>70% of spend):** likely a prompt
     regression or tool-loop. Check golden evals for the agent
     (`test/agent-evals/cases/<agent-id>/`) — if the token count per
     run drifted 2×+, that's the cause. File bug, pin the model
     version, or tighten the tool-use budget.
   - **If one day dominates:** check the agent-eval dashboard for
     failed reruns — `triggerKind=SCHEDULE` runs that retried on a
     timeout loop can burn through budget.
   - **If spread is uniform:** the institution is genuinely using the
     platform heavily. Consider upgrading their tier cap.

3. **Communicate.** Reach out to the institution's primary contact:
   ```
   Subject: CERNIQ — Your monthly AI usage is at 85%
   Body: Hi [name], we wanted to give you a heads-up that your
   account has reached 85% of your included AI analysis budget
   this month. You have $X remaining. We're happy to discuss an
   upgrade if you're finding value — just reply here.
   ```
   Use Resend to send. Log the outreach in the customer CRM.

## 🔴 WARN → BLOCKED transition

**Detection:** Same alert channel but tagged `CRITICAL`. Every new
`POST /api/v1/agents/:id/run` request returns 402 Payment Required with
body `{"error":"BUDGET_EXCEEDED","state":"BLOCKED", ...}`. The
frontend `CommandPalette` + agent pages render the red banner.

**5-step response (SLA: 5 min):**

1. **Confirm the block is correct** (not a bug):
   ```bash
   # Verify spent > cap:
   curl ... /cost | jq '.monthToDate.usdCents, .capUsdCents'
   ```
   If `monthToDate.usdCents < capUsdCents` and state still `BLOCKED`,
   that's a cache staleness bug — restart the breaker state:
   ```bash
   railway restart --service cerniq-api --environment production
   ```

2. **Decide: pause or allow.** Two paths:

   **A. Pause (default for unexpected spike):** leave BLOCKED active,
   investigate the root cause per OK→WARN step 2 above. Customer
   can't trigger new runs until (i) new calendar month starts, or
   (ii) cap is raised, or (iii) the institution is moved to a
   higher tier with a bigger cap.

   **B. Allow (for known-good institution):** raise the cap.
   ```bash
   # Temporary increase — good for 24h while proper tier upgrade
   # is negotiated:
   railway variables --set LLM_COST_CAP_USD_CENTS=20000 \
     --service cerniq-api --environment production
   # WARNING: this raises the cap for ALL institutions. For
   # per-institution override, use Institution.llmCostCapUsdCents
   # (requires SQL update until admin UI is built).
   ```

3. **If per-institution override is needed** (preferred over global
   cap raise):
   ```sql
   -- Raise Acme Coop to $500/month cap
   UPDATE institutions
      SET llm_cost_cap_usd_cents = 50000
    WHERE id = '<institutionId>';
   ```
   Within 60s, the circuit breaker picks up the new value on the
   next run trigger (it reads the column fresh each time, no cache).

4. **Communicate.** Send the institution:
   ```
   Subject: CERNIQ — AI budget exceeded this month
   Body: Hi [name], we've temporarily paused new AI analyses for
   your account to prevent unexpected billing. Your current
   month's usage is $X.XX against a $Y.YY budget.
   Options:
     (a) Wait until [first of next month] — resets automatically
     (b) Upgrade to the [next tier] — $Z/month for $W budget
     (c) One-time top-up — $100 adds $X in analyses
   Reply here and we'll get it sorted in 10 minutes.
   ```

5. **Post-mortem within 48h.** If the block was caused by a prompt
   regression or tool-loop bug, file a blameless PM:
   - Which agent caused it?
   - Was there a golden eval that should have caught this pre-deploy?
   - What pre-commit gate would prevent recurrence?

## 🟢 Month rollover

On the 1st of each calendar month (UTC), `monthToDateSpend()` returns 0
for all institutions and states flip back to OK automatically. No
operator action needed. The rollover is a natural consequence of the
`SELECT SUM WHERE created_at >= date_trunc('month', now())` query.

## ⚙️ Tuning recommendations

- **Default cap $100/month** is a placeholder. Actual caps should be
  set per-tier:
  - Starter: $25/mo (~1k agent runs)
  - Standard: $100/mo (~4k runs)
  - Partner (CPA firm): $500/mo (~20k runs)
  - Enterprise: unmetered (`LLM_COST_CAP_USD_CENTS=0`)
- **Warn threshold (80%) is hardcoded.** If this proves too noisy,
  expose as `LLM_COST_WARN_PERCENT` env var.
- **Currency is USD-cents.** For non-USD billing, convert at cap-check
  time — do NOT multiply every cost at write time.

## 🔗 Related

- [SECRETS_ROTATION.md](SECRETS_ROTATION.md) — Anthropic API key rotation procedure
- [AGENT_RUNTIME_RUNBOOK.md](AGENT_RUNTIME_RUNBOOK.md) — full agent-layer ops
- `backend-node/src/queue/agent/agent-cost-circuit-breaker.service.ts` — implementation
- `backend-node/src/config/env.schema.ts:119` — `LLM_COST_CAP_USD_CENTS` validation
