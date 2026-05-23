# Resend — Domain Verification for cerniq.io

> 2026-05-18 status: `cerniq.io` is not yet added in Resend. The current
> Resend account/API state rejected adding another domain because the active
> plan allows one domain and `cerniqtech.com` is already using that slot. Do
> not guess DKIM records. Upgrade/free the Resend domain slot, add `cerniq.io`
> in Resend, then paste the exact provider-generated records here.

Goal: enable Resend to send authenticated email **from** `erwin@cerniq.io`,
`noreply@cerniq.io`, and any other `@cerniq.io` address, passing SPF, DKIM,
and DMARC checks so Gmail/Outlook deliver to inbox (not spam).

Registrar: **Spaceship** (https://www.spaceship.com/application/dns-manager/)
DNS provider: Spaceship DNS (default).

## Why three records?

| Record | What it proves                                                    | If missing                               |
|--------|-------------------------------------------------------------------|------------------------------------------|
| SPF    | "Resend's servers are allowed to send mail claiming to be @cerniq.io." | Gmail: often hard bounce or spam.    |
| DKIM   | "This message was signed by cerniq.io's private key — it's genuine."  | Gmail: no "via resend.dev" banner → spam. |
| DMARC  | "If SPF or DKIM fail, do X (reject / quarantine / monitor)."      | No policy → spoofing remains possible.   |

You need all three for enterprise deliverability. Fintech prospects' spam
filters are aggressive; missing DMARC alone drops open rate ~15–30%.

## Step 1 — Add the domain in Resend

1. https://resend.com/domains → **Add Domain** → `cerniq.io`
2. Region: **us-east-1** (matches our backend latency profile)
3. Resend displays **4 DNS records** you must add. The DKIM selector and value
   are unique per domain, so **copy them from the dashboard** — do not guess.
4. Leave the tab open; you'll return to hit "Verify" after Step 2.

## Step 2 — Add DNS records in Spaceship

Open: https://www.spaceship.com/application/dns-manager/cerniq.io/

Add **each** record exactly as Resend displays them. Spaceship's "Host" field
takes the subdomain only (drop `.cerniq.io` — they append it). The records:

### 2a. SPF (TXT on the root)

`cerniq.io` has two planned authorized senders:

- Google Workspace for inbox/reply mail.
- Resend for backend transactional mail.

There must be one apex SPF record, merged across both senders:

| Field   | Value                                            |
|---------|--------------------------------------------------|
| Type    | TXT                                              |
| Host    | `@`                                              |
| Value   | `v=spf1 include:_spf.google.com include:_spf.resend.com -all` |
| TTL     | 3600 (1 hour) — or 300 while testing             |

> If you already have a root SPF record, **merge**, don't duplicate. SPF only
> allows one record per domain. Use `~all` temporarily only while inventorying
> an unknown sender; fix the include list and return to `-all`.

### 2b. DKIM (TXT on resend._domainkey)

Resend generates a unique value; paste the one from their dashboard.

| Field   | Value                                                 |
|---------|-------------------------------------------------------|
| Type    | TXT                                                   |
| Host    | `resend._domainkey`                                   |
| Value   | *(long string starting with `p=MIGfMA0...` — from Resend)* |
| TTL     | 3600                                                  |

> Resend sometimes provides a CNAME instead of a raw TXT. Use whichever they
> show in the dashboard for **your** domain — don't mix them up.

### 2c. MX for bounce handling

| Field    | Value                                    |
|----------|------------------------------------------|
| Type     | MX                                       |
| Host     | `send` (so `send.cerniq.io`)             |
| Priority | 10                                       |
| Value    | `feedback-smtp.us-east-1.amazonses.com`  |
| TTL      | 3600                                     |

> This lets Resend capture hard/soft bounces. Without it, bounce data is lost
> and you can't prune dead leads from the CRM automatically.

### 2d. DMARC (TXT on _dmarc)

**Launch value — monitoring first while Workspace and Resend are being wired:**

| Field | Value                                                                                           |
|-------|-------------------------------------------------------------------------------------------------|
| Type  | TXT                                                                                             |
| Host  | `_dmarc`                                                                                        |
| Value | `v=DMARC1; p=none; rua=mailto:kiess@klytics.io; ruf=mailto:kiess@klytics.io; fo=1; aspf=s; adkim=s; pct=100;` |
| TTL   | 3600                                                                                            |

**Decoded:**
- `p=none` — monitor first while Google Workspace and Resend are both being introduced.
- `pct=100` — applies policy to 100% of failing mail. We're a brand-new domain with no legacy senders, so no ramp needed.
- `rua=mailto:kiess@klytics.io` — weekly XML aggregate reports from major ISPs
- `ruf=mailto:kiess@klytics.io` — per-message forensic failure reports
- `adkim=s` / `aspf=s` — **strict** alignment (exact domain match, not subdomain). Required for enterprise inbox placement.
- `fo=1` — emit forensic reports when EITHER SPF or DKIM fails (catches misconfigs faster than the default `fo=0`)

### Pre-requisite: external DMARC report authorization on klytics.io

Because `cerniq.io` reports to a mailbox at `klytics.io`, this TXT record must
exist in Cloudflare for `klytics.io` before relying on external aggregate
reports:

```text
cerniq.io._report._dmarc.klytics.io TXT "v=DMARC1"
```

2026-05-18 status: added in Cloudflare and verified via public resolvers:

```bash
dig @1.1.1.1 +short cerniq.io._report._dmarc.klytics.io TXT
# "v=DMARC1"
```

Without this authorization, some receivers will suppress reports even though
the `_dmarc.cerniq.io` policy record exists.

### Ramp plan to `p=reject` (enterprise endpoint)

**Day 1:** launch `p=none` with strict alignment and reporting.

**Days 1-30:** check the DMARC aggregator dashboard weekly. Look for legitimate
mail failing SPF or DKIM — it means a forgotten sender. Common culprits:
- Calendly confirmations using a sender alias
- Stripe receipts if you route them through an alias
- GitHub notifications (rare — they use their own domain)

Fix upstream senders as you find them. Zero days without a false-fail = raise.

**After 14 clean days:** ratchet to `p=quarantine; pct=25`, then
`p=quarantine; pct=100`, then `p=reject` after two consecutive clean weeks.

```
v=DMARC1; p=reject; pct=100; rua=mailto:kiess@klytics.io; adkim=s; aspf=s; fo=1
```

`p=reject` hard-bounces spoofed mail. Every major bank and fintech runs this;
it's the enterprise endpoint. Losing legitimate mail is the reason to wait the
30 days — once you're confident, there's no reason not to be here.

## Step 3 — Verify

Spaceship DNS propagates in 2–15 minutes typically. Run the verifier:

```bash
scripts/ops/verify-resend-dns.sh
```

It checks all four records via `dig` and returns green only when all four
pass. Then click **Verify** in the Resend dashboard — it should go green
within seconds (Resend uses the same DNS).

## Step 4 — Smoke test

Once Resend marks the domain Verified, send a test to an external Gmail:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Erwin <erwin@cerniq.io>",
    "to": "eskiessalfonso@gmail.com",
    "subject": "CERNIQ deliverability smoke test",
    "text": "If this lands in Inbox (not Spam) with a Gmail lock icon, DKIM + SPF + DMARC are all green."
  }'
```

Open the message → click the three-dot menu → "Show original". Look for:

- `SPF: PASS with IP ...`
- `DKIM: PASS with domain cerniq.io`
- `DMARC: PASS`

All three green = you're done.

## Step 5 — Monitor

- Inspect weekly DMARC aggregate reports landing in `dmarc@cerniq.io`
- Watch Resend dashboard for bounce rate spikes (>5% = investigate list quality)
- Re-run `verify-resend-dns.sh` monthly (or add it as a CI cron) — registrars
  occasionally "helpfully" strip records during UI redesigns.

## Common pitfalls

- **Two SPF records** → all SPF evaluation fails (spec allows exactly one).
  Merge into a single record with multiple `include:` directives.
- **DKIM value wrapped / truncated** → Spaceship's UI sometimes adds a
  newline. Paste the full value on one line.
- **DMARC with wrong `rua`** → reports go to `/dev/null`. Make sure the
  address exists and you can read it.
- **Apex vs subdomain confusion** → DMARC must be on `_dmarc.cerniq.io`,
  SPF must be on the apex `cerniq.io`, DKIM on `resend._domainkey.cerniq.io`.
