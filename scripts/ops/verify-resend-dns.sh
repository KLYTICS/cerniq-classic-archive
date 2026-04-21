#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Verify Resend DNS records are live and well-formed for cerniq.io.
#
# Checks SPF, DKIM, MX (bounce), DMARC — exits 0 only when all four pass.
# Uses authoritative nameservers (not local cache) so you don't chase stale TTLs.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

DOMAIN="${1:-cerniq.io}"

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
ok()    { color "32" "✔ $*"; }
fail()  { color "31" "✘ $*"; }
warn()  { color "33" "⚠ $*"; }
info()  { color "36" "ℹ $*"; }

command -v dig >/dev/null 2>&1 || { fail "dig not installed"; exit 1; }

# Resolve the authoritative NS for the zone once, then query it directly.
# This bypasses recursive-resolver caches that lag behind by TTL seconds.
AUTH_NS="$(dig +short NS "$DOMAIN" | head -1)"
if [[ -z "$AUTH_NS" ]]; then
  warn "could not find NS for $DOMAIN — falling back to system resolver"
  AUTH_NS=""
fi

query() {
  local type="$1" host="$2"
  if [[ -n "$AUTH_NS" ]]; then
    dig +short "$type" "$host" "@$AUTH_NS" 2>/dev/null
  else
    dig +short "$type" "$host" 2>/dev/null
  fi
}

FAIL=0

info "Domain: $DOMAIN  (authoritative NS: ${AUTH_NS:-system})"
echo

# ─── SPF ──────────────────────────────────────────────────────────────────
echo "─── SPF (TXT $DOMAIN) ───"
spf_records=$(query TXT "$DOMAIN" | grep -i 'v=spf1' || true)
spf_count=$(printf '%s\n' "$spf_records" | grep -c 'v=spf1' || true)
if [[ "$spf_count" -eq 0 ]]; then
  fail "no SPF record found"
  FAIL=$((FAIL+1))
elif [[ "$spf_count" -gt 1 ]]; then
  fail "MULTIPLE SPF records (spec allows one) — merge into a single TXT"
  FAIL=$((FAIL+1))
else
  if grep -q 'include:_spf.resend.com' <<<"$spf_records"; then
    ok "SPF includes _spf.resend.com: $spf_records"
  else
    fail "SPF present but missing 'include:_spf.resend.com': $spf_records"
    FAIL=$((FAIL+1))
  fi
fi

# ─── DKIM ─────────────────────────────────────────────────────────────────
echo
echo "─── DKIM (TXT resend._domainkey.$DOMAIN) ───"
dkim_txt=$(query TXT "resend._domainkey.$DOMAIN" || true)
dkim_cname=$(query CNAME "resend._domainkey.$DOMAIN" || true)
if [[ -n "$dkim_txt" ]] && grep -q 'p=' <<<"$dkim_txt"; then
  # Concatenate quoted strings and measure the key length
  key_len=$(printf '%s' "$dkim_txt" | tr -d '" ' | sed 's/.*p=//' | wc -c | tr -d ' ')
  if [[ $key_len -lt 200 ]]; then
    fail "DKIM TXT present but key looks truncated (len=$key_len, expect ≥200 for RSA-2048)"
    FAIL=$((FAIL+1))
  else
    ok "DKIM TXT present (key len ≈ $key_len chars)"
  fi
elif [[ -n "$dkim_cname" ]]; then
  ok "DKIM CNAME present → $dkim_cname"
else
  fail "no DKIM record at resend._domainkey.$DOMAIN (neither TXT nor CNAME)"
  FAIL=$((FAIL+1))
fi

# ─── MX (bounce) ──────────────────────────────────────────────────────────
echo
echo "─── MX (send.$DOMAIN, Resend bounce) ───"
mx=$(query MX "send.$DOMAIN" || true)
if [[ -z "$mx" ]]; then
  fail "no MX record at send.$DOMAIN — bounce handling will be lost"
  FAIL=$((FAIL+1))
elif grep -q 'feedback-smtp.*amazonses.com' <<<"$mx"; then
  ok "MX points to Resend's AWS SES bounce handler: $mx"
else
  warn "MX found but not the expected feedback-smtp.*.amazonses.com: $mx"
fi

# ─── DMARC ────────────────────────────────────────────────────────────────
echo
echo "─── DMARC (TXT _dmarc.$DOMAIN) ───"
dmarc=$(query TXT "_dmarc.$DOMAIN" | grep -i 'v=DMARC1' || true)
if [[ -z "$dmarc" ]]; then
  fail "no DMARC record at _dmarc.$DOMAIN"
  FAIL=$((FAIL+1))
else
  policy=$(sed -n 's/.*p=\([a-z]*\).*/\1/p' <<<"$dmarc")
  rua=$(sed -n 's/.*rua=mailto:\([^;" ]*\).*/\1/p' <<<"$dmarc")
  adkim=$(grep -o 'adkim=[a-z]' <<<"$dmarc" | head -1 | cut -d= -f2 || true)
  aspf=$(grep -o 'aspf=[a-z]'  <<<"$dmarc" | head -1 | cut -d= -f2 || true)
  pct=$(sed -n 's/.*pct=\([0-9]*\).*/\1/p' <<<"$dmarc")

  # Enterprise policy: at least quarantine, strict alignment, real rua.
  case "$policy" in
    none)
      fail "DMARC p=none — enterprise policy requires p=quarantine or p=reject"
      FAIL=$((FAIL+1)) ;;
    quarantine)
      ok "DMARC p=quarantine (launch value)" ;;
    reject)
      ok "DMARC p=reject (enterprise endpoint — nice)" ;;
    *)
      fail "DMARC policy unrecognized: '$policy' in $dmarc"
      FAIL=$((FAIL+1)) ;;
  esac

  if [[ -z "$rua" ]]; then
    fail "DMARC missing rua= — aggregate reports would be discarded"
    FAIL=$((FAIL+1))
  else
    ok "DMARC aggregate reports → $rua"
  fi

  [[ "$adkim" == "s" ]] && ok "DKIM alignment: strict (adkim=s)" || {
    warn "DKIM alignment not strict (adkim=${adkim:-relaxed}) — enterprise policy wants adkim=s"
  }
  [[ "$aspf"  == "s" ]] && ok "SPF alignment:  strict (aspf=s)"  || {
    warn "SPF alignment not strict (aspf=${aspf:-relaxed}) — enterprise policy wants aspf=s"
  }
  if [[ -n "$pct" && "$pct" != "100" ]]; then
    warn "DMARC pct=$pct — only applies policy to $pct% of failures. Raise to 100 when ready."
  fi
fi

echo
if [[ $FAIL -eq 0 ]]; then
  ok "All Resend DNS records look good. Click 'Verify' in the Resend dashboard."
  exit 0
else
  fail "$FAIL record(s) need attention — see docs/ops/resend_dns_setup.md"
  exit 1
fi
