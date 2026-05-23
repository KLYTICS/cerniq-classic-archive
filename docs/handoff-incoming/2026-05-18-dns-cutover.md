# 2026-05-18 DNS Cutover Handoff

## Completed

- Restored the stable API hostname without changing source code:
  - `api.cerniq.io CNAME lnybhd8b.up.railway.app.`
  - TTL: 1 minute
  - Railway custom domain: `api.cerniq.io`
  - Railway project: `cerniq-api` (`1ad9be3e-c89d-4b18-9af2-b1775a14161d`)
  - Railway environment: `production` (`8e51374b-5f13-4980-a037-007c6c1792bc`)
  - Railway service: `cerniq-api-backend` (`9b95101a-736a-4349-83ca-d901dc8f1757`)
- Railway accepted the current `_railway-verify.api.cerniq.io` TXT record and issued a valid certificate for `api.cerniq.io`.
- Added CAA issuance pinning on `cerniq.io`:
  - `0 issue "letsencrypt.org"`
  - `0 issue "pki.goog"`
  - `0 iodef "mailto:eskiessalfonso@gmail.com"`
- Added the `klytics.io` companion DNS records in Cloudflare:
  - CAA includes `0 issue "letsencrypt.org"`
  - CAA includes `0 issue "pki.goog"`
  - CAA includes `0 iodef "mailto:kiess@klytics.io"`
  - `cerniq.io._report._dmarc.klytics.io TXT "v=DMARC1"`

## Verification Evidence

```bash
dig +short api.cerniq.io CNAME
# lnybhd8b.up.railway.app.

curl -sS https://api.cerniq.io/api/v1/health
# {"success":true,"data":{"status":"ok","version":"1.0.0","service":"cerniq-api-v1",...}}

curl -sS https://cerniq.io/api/v1/health
# {"success":true,"data":{"status":"ok","version":"1.0.0","service":"cerniq-api-v1",...}}

echo | openssl s_client -servername api.cerniq.io -connect api.cerniq.io:443 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName -dates
# subject=CN=api.cerniq.io
# X509v3 Subject Alternative Name:
#     DNS:api.cerniq.io
# notBefore=May 18 17:36:39 2026 GMT
# notAfter=Aug 16 17:36:38 2026 GMT

dig @launch1.spaceship.net +short cerniq.io CAA
# 0 issue "pki.goog"
# 0 issue "letsencrypt.org"
# 0 iodef "mailto:eskiessalfonso@gmail.com"

dig @1.1.1.1 +short cerniq.io._report._dmarc.klytics.io TXT
# "v=DMARC1"

dig +short klytics.io CAA
# includes 0 issue "letsencrypt.org", 0 issue "pki.goog", and 0 iodef "mailto:kiess@klytics.io"
```

## Not Completed

- Google Workspace secondary-domain setup for `cerniq.io` is still required before Google verification TXT, Google DKIM, and `hello@cerniq.io` can be finalized.
- Spaceship rejected the attempted apex MX row for `cerniq.io` with `Invalid host value` even when using the dashboard's `@` root-domain syntax. No MX record was committed.
- Apex SPF and DMARC were not committed because they depend on the final Workspace/Resend sender inventory and, for SPF, the same apex-host dashboard path that rejected MX.
- Resend could not add `cerniq.io` from the current Resend account/API state because the account plan is already using its one allowed domain slot for `cerniqtech.com`.
- `cerniqtech.com` 301 forwarding remains pending.

Note: Cloudflare still labels `klytics.io` as pending in the dashboard, even
though its assigned nameservers answer and public resolvers now return the new
CAA/report-authorization records. Re-check the Cloudflare Overview page after
DNS settles.

## Follow-Up Order

1. In Google Workspace, add `cerniq.io` as a secondary domain and copy the provider-generated verification TXT.
2. Resolve Spaceship's apex MX creation issue, then add `cerniq.io MX 1 smtp.google.com.`.
3. Generate Google DKIM for `cerniq.io` and add the provider-generated TXT.
4. Upgrade or free the Resend domain slot, add `cerniq.io`, then add the exact Resend-generated DKIM/SPF/MX records.
5. Add the final single apex SPF TXT covering all authorized senders.
6. Add `_dmarc.cerniq.io`; the external-report authorization record now exists on `klytics.io`.
7. Configure `cerniqtech.com` and `www.cerniqtech.com` 301 forwarding in Spaceship.
