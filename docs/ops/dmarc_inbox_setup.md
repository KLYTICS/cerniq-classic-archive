# `dmarc@cerniq.io` — the missing prereq

The DMARC record in `docs/ops/resend_dns_setup.md` points aggregate reports
(`rua=`) and forensic reports (`ruf=`) at `dmarc@cerniq.io`. That mailbox
**must exist** before the record is saved, or every major ISP's DMARC
aggregator will fail to deliver — silently — and you'll have compliance
theater instead of actual monitoring.

Pick **one** of the two options below. Recommend Option B (aggregator)
unless you genuinely want to parse XML reports by hand.

## Option A — Resend Inbound Forwarder (simple, noisy)

Resend supports inbound email routing. Set up a forwarder that catches
every `@cerniq.io` address (or just `dmarc@`) and ships it to your Gmail.

1. **Add MX records for inbound** (different from the `send.cerniq.io` MX
   you already added for bounces). In Spaceship DNS:

   | Type | Host | Priority | Value                       | TTL  |
   |------|------|----------|-----------------------------|------|
   | MX   | `@`  | 10       | `mx.inbound.resend.com`     | 3600 |
   | MX   | `@`  | 20       | `mx2.inbound.resend.com`    | 3600 |

2. **Create the inbound route in Resend** (Dashboard → Domains → cerniq.io
   → Inbound → Add Route):

   | Field      | Value                                     |
   |------------|-------------------------------------------|
   | From       | `.*@cerniq.io` (regex match)              |
   | Action     | Forward                                   |
   | Destination| `eskiessalfonso@gmail.com`                |

3. **Smoke test** (send from an external address to `dmarc@cerniq.io`,
   verify it lands in your Gmail within ~30 sec).

4. **Gmail filter** (otherwise DMARC XML floods your inbox):

   - Create filter → From: `*@google.com` OR `*@yahoo.com` OR
     `*@microsoft.com` OR `*@outlook.com` → has attachment `*.zip` OR `*.gz`
   - Action: Skip inbox + Apply label `DMARC`

**Cost:** Free tier of Resend includes inbound. **Noise:** high — you'll
get 20-100 XML attachments per week per reporter per domain; they're not
human-readable without a parser.

## Option B — Aggregator (preferred)

Free aggregators parse the XML and give you a dashboard. Reports become
"how many sources tried to spoof you in the last 24h" instead of
"here are 47 unreadable zip files."

### B1. Postmark DNS Monitoring (recommended)

Free up to 10k messages/week of report data — plenty for a new domain.

1. Sign up: https://dmarc.postmarkapp.com (no credit card)
2. Add domain `cerniq.io` — Postmark gives you an address like
   `abc123xyz@dmarc.postmarkapp.com`
3. **Update the DMARC record** — in Spaceship DNS, edit the
   `_dmarc.cerniq.io` TXT to replace `mailto:dmarc@cerniq.io` with
   Postmark's address:

   ```
   v=DMARC1; p=quarantine; pct=100; rua=mailto:abc123xyz@dmarc.postmarkapp.com; ruf=mailto:abc123xyz@dmarc.postmarkapp.com; adkim=s; aspf=s; fo=1
   ```

4. Re-run: `scripts/ops/verify-resend-dns.sh` → green
5. First reports typically arrive within 24h from Google, within 72h
   from all major ISPs.
6. Weekly ritual: spend 5 min on the Postmark dashboard. Anything red
   = upstream sender is broken, fix it before raising to `p=reject`.

### B2. dmarcanalyzer.com (50k/month free)

Same pattern, different provider. Their free tier is more generous but
the UX is heavier. Use this if Postmark's free tier becomes a limit.

## Which to pick?

- **You'll look at reports weekly** → Option B (aggregator). You want a
  dashboard, not an inbox fire hose.
- **You want belt-and-suspenders** → Option B **and** keep a `dmarc@`
  forwarder too, so forensic reports (`ruf=`) also copy to you for
  incident investigation.
- **You're deferring monitoring** → pick B1, put a calendar reminder
  for 30 days out to actually look at the dashboard, then raise to
  `p=reject` if clean.

## Verification

After picking an option:

```bash
scripts/ops/verify-resend-dns.sh
```

Should report:
- ✔ DMARC aggregate reports → *<your chosen rua address>*
- ✔ DMARC p=quarantine (launch value)
- ✔ DKIM alignment: strict (adkim=s)
- ✔ SPF alignment:  strict (aspf=s)

Then the 30-day clock starts on the ramp plan in `resend_dns_setup.md`.

## What I won't automate

Postmark/aggregator setup requires a browser (no public signup API), and
DNS edits live in a dashboard. Those stay manual. The verifier is the
only part that runs unattended.
