# Incident response playbook (baseline)

Audience: Operators and security-contact roles for CERNIQ production environments.

## Severities

- **Sev1** — Active data breach, mass auth bypass, ransomware, production database exfiltration.
- **Sev2** — Isolated privileged misuse, Stripe/webhook anomalies, prolonged outage with customer impact.
- **Sev3** — Single-customer leakage suspected, credential rotation needed, failed pen test findings.

## Initial response

1. **Preserve evidence** — Do not wipe logs or DBs without legal/ops clearance; screenshot dashboards and export relevant log windows.
2. **Contain** — Rotate `ADMIN_KEY`, Stripe webhook secret, JWT signing/material if compromise suspected; revoke API keys institution-wide via admin tooling if needed.
3. **Escalate** — Notify founders/security contact; invoke hosting provider abuse/security if infra-level compromise.

## Customer / regulator path

Prepare facts: scope of data classes (see data classification inventory), timelines, corrective actions — align with SOC 2 and applicable vendor agreements.

This document is deliberately short; iterate with tabletop exercises quarterly.
