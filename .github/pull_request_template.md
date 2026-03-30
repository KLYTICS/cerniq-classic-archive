## Summary

- lane / subsystem:
- user or operator impact:
- quant-sensitive behavior touched:

## Verification

- [ ] `make release-gate`
- [ ] `CI Quick Check` passed
- [ ] `CERNIQ CI/CD` passed

Commands run:

```bash
# paste exact local commands here
```

## Shared State Risks

- [ ] auth/session files touched
- [ ] coverage config or release scripts touched
- [ ] coordination or deploy docs touched
- [ ] none

Details:

- files:
- expected cross-lane effect:

## Deploy Notes

- [ ] No schema change
- [ ] Schema change requires explicit `npm run prisma:deploy`
- [ ] Backend async-exit warning triaged if still present

Post-merge verification plan:

- [ ] `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io`
- [ ] `/health`, `/ready`, `/api/status`, pricing page, and admin auth spot checks
