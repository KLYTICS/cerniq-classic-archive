#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Pre-flight check for UptimeRobot monitors. Hits every production URL
# that will be monitored and asserts status code + expected keyword.
#
# Exit 0 = every monitor target passes. Exit 1 = at least one fails.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
ok()    { color "32" "✔ $*"; }
fail()  { color "31" "✘ $*"; }
warn()  { color "33" "⚠ $*"; }

FAILED=0

# url  expected-status  keyword-or-empty  label
MONITORS=(
  "https://cerniq.io/                            200 CERNIQ            frontend·root"
  "https://cerniq.io/api/health                  200 healthy           frontend·health"
  "https://api.cerniq.io/health                  200 status            api·health"
  "https://api.cerniq.io/ready                   200 ready             api·ready"
  "https://api.cerniq.io/health/live             200 alive             api·live"
  "https://cerniq.io/portal                      200 portal            frontend·portal"
  "https://api.cerniq.io/api/billing/webhook/healthcheck  200 stripe-webhook  api·stripe-webhook"
)

for row in "${MONITORS[@]}"; do
  # shellcheck disable=SC2086
  set -- $row
  url="$1"; expect_status="$2"; keyword="$3"; label="$4"

  body_file="$(mktemp)"
  # shellcheck disable=SC2086
  status="$(curl -sS -o "$body_file" -w '%{http_code}' --max-time 10 -L "$url" 2>/dev/null || echo 000)"

  if [[ "$status" != "$expect_status" ]]; then
    fail "$label  expected HTTP $expect_status, got $status  ($url)"
    FAILED=$((FAILED+1))
    rm -f "$body_file"
    continue
  fi

  if [[ -n "$keyword" ]] && ! grep -q -- "$keyword" "$body_file" 2>/dev/null; then
    fail "$label  HTTP $status but keyword '$keyword' missing  ($url)"
    FAILED=$((FAILED+1))
    rm -f "$body_file"
    continue
  fi

  ok "$label  HTTP $status  keyword='$keyword'"
  rm -f "$body_file"
done

# SSL expiry — warn only, does not fail the script
echo
echo "─── SSL certificate expiry ───"
for host in cerniq.io api.cerniq.io; do
  end="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
  if [[ -z "$end" ]]; then warn "$host cert — could not read"; continue; fi
  ts_end=$(date -j -f '%b %d %H:%M:%S %Y %Z' "$end" +%s 2>/dev/null || date -d "$end" +%s 2>/dev/null)
  ts_now=$(date +%s)
  days=$(( (ts_end - ts_now) / 86400 ))
  if [[ $days -lt 14 ]]; then fail "$host cert expires in $days days ($end)"; FAILED=$((FAILED+1))
  elif [[ $days -lt 30 ]]; then warn "$host cert expires in $days days ($end)"
  else ok "$host cert expires in $days days"; fi
done

echo
if [[ $FAILED -eq 0 ]]; then
  ok "All monitor targets are healthy — safe to create UptimeRobot monitors."
  exit 0
else
  fail "$FAILED target(s) failed — fix before creating monitors to avoid false alerts."
  exit 1
fi
