# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in CERNIQ, please report it responsibly.

**DO NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email **security@cerniq.io** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Your suggested fix (if any)

2. You will receive an acknowledgment within **48 hours**.

3. We will investigate and provide a timeline for a fix within **5 business days**.

4. Once the fix is deployed, we will publicly disclose the vulnerability with credit to the reporter (unless you prefer anonymity).

### Scope

The following are in scope:
- **cerniq.io** (production frontend)
- **api.cerniq.io** (production API)
- Authentication and authorization bypasses
- SQL injection, XSS, CSRF
- Server-side request forgery (SSRF)
- Sensitive data exposure
- API rate limiting bypasses

### Out of Scope

- Denial of service attacks
- Social engineering
- Physical security
- Third-party services (Stripe, Supabase, Railway)

### Security Measures

CERNIQ implements:
- Helmet.js with CSP (nonce-based script policy)
- HSTS preload
- CORS origin allowlisting
- API key rate limiting (Redis-backed)
- Input validation (class-validator)
- PII encryption at rest (AES-256-GCM)
- Audit logging for all mutations
- Automated dependency updates (Dependabot)
- CodeQL static analysis
- Sentry error tracking with PII scrubbing

### Compliance

CERNIQ is designed for COSSEC/NCUA regulatory compliance and handles sensitive financial institution data accordingly.
