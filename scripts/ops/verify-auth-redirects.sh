#!/usr/bin/env bash
# Assert that Supabase sends authenticated users to production, not localhost.
#
# WHY THIS EXISTS
# ---------------
# On 2026-08-02 sign-in was reported as "it just redirects back to my
# localhost". The Supabase project's **Site URL** was `http://localhost:3000`.
#
# Supabase redirects to the Site URL whenever the `redirect_to` a client asks
# for is not in the project's allow list. The frontend correctly requests
# `https://cerniq.io/auth/callback`, and the backend correctly uses
# `FRONTEND_URL=https://cerniq.io` for magic links — but with cerniq.io absent
# from the allow list, every one of those was silently rewritten to localhost.
# Nothing in the repo, in Railway, or in Vercel was wrong; the setting lives in
# the Supabase project and is invisible to every other check we run.
#
# This gate makes that setting observable: it asks Supabase where it would
# actually send a user and fails if the answer is not production.
#
# Usage:
#   bash scripts/ops/verify-auth-redirects.sh
#   CERNIQ_EXPECTED_ORIGIN=https://staging.cerniq.io bash scripts/ops/verify-auth-redirects.sh
#
# Credentials: uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
# environment when present; otherwise reads them from the Railway API via the
# logged-in CLI's token. Neither is ever printed.

set -euo pipefail

EXPECTED_ORIGIN="${CERNIQ_EXPECTED_ORIGIN:-https://cerniq.io}"
PROBE_EMAIL="${CERNIQ_AUTH_PROBE_EMAIL:-probe.1772158044.9c7ed8@klytics.local}"

export CERNIQ_EXPECTED_ORIGIN="$EXPECTED_ORIGIN"
export CERNIQ_AUTH_PROBE_EMAIL="$PROBE_EMAIL"
export CERNIQ_SUPABASE_URL="${SUPABASE_URL:-}"
export CERNIQ_SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# Railway coordinates (public identifiers, not secrets) — declared once here so
# the embedded Python never re-states them. Two copies of a high-entropy UUID
# also trips gitleaks' generic-api-key rule.
export CERNIQ_RAILWAY_PROJECT_ID="${CERNIQ_RAILWAY_PROJECT_ID:-1ad9be3e-c89d-4b18-9af2-b1775a14161d}"
export CERNIQ_RAILWAY_ENV_ID="${CERNIQ_RAILWAY_ENV_ID:-8e51374b-5f13-4980-a037-007c6c1792bc}"
export CERNIQ_API_SERVICE_ID="${CERNIQ_API_SERVICE_ID:-9b95101a-736a-4349-83ca-d901dc8f1757}"

python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error, urllib.parse

EXPECTED = os.environ['CERNIQ_EXPECTED_ORIGIN'].rstrip('/')
PROBE = os.environ['CERNIQ_AUTH_PROBE_EMAIL']
UA = {'User-Agent': 'cerniq-ops/1.0'}


def post(url, payload, headers, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={**headers, 'Content-Type': 'application/json', **UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


url = os.environ.get('CERNIQ_SUPABASE_URL', '').strip()
key = os.environ.get('CERNIQ_SUPABASE_KEY', '').strip()

if not url or not key:
    # Fall back to the Railway API, same source the backend runs with.
    cfg = os.path.expanduser('~/.railway/config.json')
    try:
        token = json.load(open(cfg))['user']['token']
    except Exception:
        sys.exit('ERROR: no SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and no Railway CLI login.')
    body = {
        'query': 'query($p: String!, $e: String!, $s: String!) {'
                 ' variables(projectId: $p, environmentId: $e, serviceId: $s) }',
        'variables': {
            'p': os.environ['CERNIQ_RAILWAY_PROJECT_ID'],
            'e': os.environ['CERNIQ_RAILWAY_ENV_ID'],
            's': os.environ['CERNIQ_API_SERVICE_ID'],
        },
    }
    try:
        v = post('https://backboard.railway.com/graphql/v2', body,
                 {'Authorization': f'Bearer {token}',
                  # Railway sits behind Cloudflare; a missing UA is rejected 403/1010.
                  'User-Agent': 'railway-cli/4.33.0'})['data']['variables']
    except (urllib.error.HTTPError, KeyError, TypeError) as e:
        sys.exit(f'ERROR: could not read Railway variables: {e}')
    url = (v.get('SUPABASE_URL') or '').strip()
    key = (v.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()

if not url or not key:
    sys.exit('ERROR: Supabase URL / service role key unavailable.')
url = url.rstrip('/')

# Ask Supabase to mint a link. With no explicit redirect_to, the returned link
# carries the project's Site URL — exactly what a real magic-link or OAuth
# callback falls back to when the requested target is not allow-listed.
try:
    d = post(f'{url}/auth/v1/admin/generate_link',
             {'type': 'magiclink', 'email': PROBE},
             {'apikey': key, 'Authorization': f'Bearer {key}'})
except urllib.error.HTTPError as e:
    sys.exit(f'ERROR: generate_link failed HTTP {e.code}: {e.read().decode()[:200]}')

link = d.get('action_link') or (d.get('properties') or {}).get('action_link', '')
target = urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get('redirect_to', [''])[0]
if not target:
    sys.exit('ERROR: no redirect_to on the generated link; cannot verify.')

parsed = urllib.parse.urlparse(target)
actual = f'{parsed.scheme}://{parsed.netloc}'
print(f'Supabase would redirect to : {actual}')
print(f'Expected                   : {EXPECTED}')

if actual.rstrip('/') != EXPECTED:
    print('')
    print('FAIL — Supabase is not sending users to production.', file=sys.stderr)
    print('', file=sys.stderr)
    print('Fix in the Supabase dashboard (Authentication -> URL Configuration):', file=sys.stderr)
    print(f'  Site URL          : {EXPECTED}', file=sys.stderr)
    print(f'  Redirect URLs     : {EXPECTED}/**', file=sys.stderr)
    print('                      https://www.cerniq.io/**', file=sys.stderr)
    print('                      http://localhost:3000/**   (keep, for local dev)', file=sys.stderr)
    print('', file=sys.stderr)
    print('Supabase silently rewrites any redirect_to that is not allow-listed', file=sys.stderr)
    print('to the Site URL, so both fields must be set.', file=sys.stderr)
    sys.exit(1)

print('')
print('PASS — Supabase redirects land on production.')
PY
