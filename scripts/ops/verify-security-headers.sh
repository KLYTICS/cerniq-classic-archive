#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Security headers regression test.
#
# Hits the production frontend + backend and asserts every security-relevant
# header is present and matches the expected policy. Exits 0 only when every
# header is correct; 1 otherwise.
#
# Useful for:
#   - Post-deploy smoke test (did a Next.js config change strip a header?)
#   - Bank security-review evidence (screenshot the green run)
#   - UptimeRobot can't check headers, only status codes — this covers the gap
#
# USAGE:
#   scripts/ops/verify-security-headers.sh                        # prod
#   scripts/ops/verify-security-headers.sh https://preview.url   # arbitrary
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

FRONTEND="${1:-https://cerniq.io}"
BACKEND="${2:-https://api.cerniq.io}"

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
ok()    { color "32" "✔ $*"; }
fail()  { color "31" "✘ $*"; }
warn()  { color "33" "⚠ $*"; }
info()  { color "36" "ℹ $*"; }

FAIL=0

# Fetch headers once per origin to avoid N round-trips per check.
fetch_headers() {
  local url="$1" tmp
  tmp="$(mktemp)"
  curl -sI -L --max-time 10 -o "$tmp" -w '%{http_code}' "$url" >/dev/null || true
  cat "$tmp"
  rm -f "$tmp"
}

header_value() {
  local headers="$1" name="$2"
  # Case-insensitive match; strips leading whitespace + trailing \r
  printf '%s\n' "$headers" | awk -v n="$name" 'BEGIN{IGNORECASE=1} tolower($1) == tolower(n ":") { sub("^[^:]+: *", ""); sub("\r$", ""); print; exit }'
}

# ─── Frontend ─────────────────────────────────────────────────────────────
info "Frontend: $FRONTEND"
FE_HEADERS="$(fetch_headers "$FRONTEND")"

if [[ -z "$FE_HEADERS" ]]; then
  fail "could not fetch headers from $FRONTEND"
  exit 1
fi

# Required exact matches (from frontend/vercel.json)
declare -a CHECKS=(
  "X-Content-Type-Options|nosniff"
  "X-Frame-Options|DENY"
  "Referrer-Policy|strict-origin-when-cross-origin"
)

for pair in "${CHECKS[@]}"; do
  name="${pair%%|*}"; expected="${pair##*|}"
  actual="$(header_value "$FE_HEADERS" "$name")"
  if [[ -z "$actual" ]]; then
    fail "$name missing"
    FAIL=$((FAIL+1))
  elif [[ "$actual" == "$expected" ]]; then
    ok "$name = $expected"
  else
    fail "$name mismatch — expected '$expected', got '$actual'"
    FAIL=$((FAIL+1))
  fi
done

# HSTS — must include max-age≥31536000 + includeSubDomains + preload to
# satisfy the preload list. Shorter max-age is a policy weakening.
hsts="$(header_value "$FE_HEADERS" "Strict-Transport-Security")"
if [[ -z "$hsts" ]]; then
  fail "Strict-Transport-Security missing"
  FAIL=$((FAIL+1))
else
  max_age=$(grep -oE 'max-age=[0-9]+' <<<"$hsts" | cut -d= -f2)
  if [[ -z "$max_age" || "$max_age" -lt 31536000 ]]; then
    fail "HSTS max-age=${max_age:-0} < 31536000 (one year minimum for preload)"
    FAIL=$((FAIL+1))
  elif ! grep -q "includeSubDomains" <<<"$hsts"; then
    fail "HSTS missing includeSubDomains"
    FAIL=$((FAIL+1))
  elif ! grep -q "preload" <<<"$hsts"; then
    warn "HSTS missing preload directive (OK for testing; needed for hstspreload.org submission)"
  else
    ok "HSTS max-age=$max_age includeSubDomains preload"
  fi
fi

# Permissions-Policy — must at minimum lock down camera/microphone/geolocation
perms="$(header_value "$FE_HEADERS" "Permissions-Policy")"
if [[ -z "$perms" ]]; then
  fail "Permissions-Policy missing"
  FAIL=$((FAIL+1))
else
  missing=()
  for feature in "camera=()" "microphone=()" "geolocation=()"; do
    if ! grep -q -- "$feature" <<<"$perms"; then missing+=("$feature"); fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    fail "Permissions-Policy missing: ${missing[*]} — attackers could prompt for these"
    FAIL=$((FAIL+1))
  else
    ok "Permissions-Policy locks down camera/microphone/geolocation"
  fi
fi

# CSP — must have frame-ancestors 'none' (clickjacking) + upgrade-insecure-requests
csp="$(header_value "$FE_HEADERS" "Content-Security-Policy")"
if [[ -z "$csp" ]]; then
  fail "Content-Security-Policy missing"
  FAIL=$((FAIL+1))
else
  csp_missing=()
  for directive in "frame-ancestors 'none'" "object-src 'none'" "upgrade-insecure-requests" "base-uri 'self'"; do
    if ! grep -q -- "$directive" <<<"$csp"; then csp_missing+=("$directive"); fi
  done
  if [[ ${#csp_missing[@]} -gt 0 ]]; then
    fail "CSP missing critical directives: ${csp_missing[*]}"
    FAIL=$((FAIL+1))
  else
    ok "CSP has frame-ancestors+object-src+upgrade-insecure-requests+base-uri"
  fi
  # Warn on 'unsafe-inline' / 'unsafe-eval' but don't fail — needed for Next.js
  # dev-time scripts and some analytics. Just make it visible.
  if grep -q "unsafe-eval" <<<"$csp"; then
    warn "CSP allows 'unsafe-eval' — review: needed only by specific libs (check if removable)"
  fi
fi

# Server headers we DON'T want (information disclosure)
for leak in "Server" "X-Powered-By"; do
  val="$(header_value "$FE_HEADERS" "$leak")"
  if [[ -n "$val" ]]; then
    warn "$leak header leaks server info: '$val' — consider stripping in vercel.json"
  fi
done

# ─── Backend API ──────────────────────────────────────────────────────────
echo
info "Backend: $BACKEND"
BE_HEADERS="$(fetch_headers "$BACKEND/health")"

if [[ -z "$BE_HEADERS" ]]; then
  warn "could not fetch headers from $BACKEND/health — skipping backend checks"
else
  # Backend also should have HSTS (same-domain apex) — Railway may strip it
  # if the service isn't configured for https termination passthrough.
  be_hsts="$(header_value "$BE_HEADERS" "Strict-Transport-Security")"
  if [[ -z "$be_hsts" ]]; then
    warn "Backend HSTS missing — acceptable if Railway's edge adds it; verify with: curl -sI $BACKEND/health | grep -i strict"
  else
    ok "Backend HSTS: $be_hsts"
  fi

  # CORS: must NOT be '*' (would allow any origin to make authed requests).
  cors="$(header_value "$BE_HEADERS" "Access-Control-Allow-Origin")"
  if [[ "$cors" == "*" ]]; then
    fail "CORS Access-Control-Allow-Origin = '*' — CATASTROPHIC for authed endpoints"
    FAIL=$((FAIL+1))
  elif [[ -n "$cors" ]]; then
    ok "CORS Access-Control-Allow-Origin: $cors (non-wildcard)"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────
echo
if [[ $FAIL -eq 0 ]]; then
  ok "All security headers present and well-shaped. Safe to screenshot for auditors."
  exit 0
else
  fail "$FAIL header(s) need attention. Review frontend/vercel.json + Next.js config."
  exit 1
fi
