# Secret Lockdown Checklist

Use this checklist after any gitleaks finding, suspected credential exposure,
or history rewrite. Never paste secret values into tickets, commits, logs, PRs,
or chat transcripts.

## Immediate Rotation

- Rotate database credentials and update the runtime `DATABASE_URL` in the
  deployment secret store.
- Rotate `JWT_SECRET`, `ADMIN_KEY`, Stripe secret/webhook keys, OpenAI,
  Anthropic, Resend, market-data provider keys, and deployment tokens that
  may have been present in local or production env files.
- Do not rotate `API_KEY_PEPPER` or `DATA_ENCRYPTION_KEY` for routine hygiene.
  Follow `SECRETS_ROTATION.md` only if there is confirmed compromise because
  these values can invalidate customer API keys or orphan encrypted data.

## Repo Cleanup

- Run `gitleaks detect --config .gitleaks.toml --redact --verbose`.
- Run `gitleaks detect --config .gitleaks.toml --redact --verbose --log-opts "--all"`.
- Verify ignored secret files stay ignored:
  `git check-ignore -v .env frontend/.env.local backend-node/.env services/outbound/.env`.
- Confirm no tracked runtime/build/legacy trees remain:
  `git ls-files .omx archive platform projects`.

## History Rewrite

- Use `scripts/ops/git-history-cleanup.sh` from a clean checkout.
- Review the generated mirror output and gitleaks results before any push.
- Announce a git freeze and verify open PR status.
- Only after explicit approval, push the rewritten mirror with
  `git push --mirror --force`.
- Every local clone must re-clone or hard-reset to the rewritten default
  branch after the force push.
