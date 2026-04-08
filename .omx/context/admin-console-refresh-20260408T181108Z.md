Task statement

Bring the CERNIQ admin console up to date, connect it more cleanly to current platform capabilities, and use coordinated multi-agent execution to discover and fix stale or missing admin integrations.

Desired outcome

- Admin routes reflect the current product surface instead of a partial or stale subset.
- Admin workflows connect cleanly to live backend/admin APIs and key CERNIQ feature areas.
- The work is documented in OMX context so future sessions can continue without re-intake.
- Changes are verified with focused lint, tests, and build evidence.

Known facts and evidence

- Active repo root: /Users/money/Desktop/Cerniq
- Stack per README: Next.js 16 frontend, NestJS 11 backend, PostgreSQL/Redis, Stripe, Resend, R2.
- Frontend admin route tree exists under frontend/app/admin with pages for audit, checklist, demo-seats, intelligence, leads, metrics, ops, pipeline, prospects, and root admin dashboard.
- Root admin page currently mixes admin auth, demo requests, simple stats, and outreach tooling in one client component.
- Admin layout is feature-gated by ENABLE_ADMIN / NEXT_PUBLIC_ENABLE_ADMIN and disabled in production unless explicitly enabled.
- Backend exposes admin-oriented endpoints including /api/admin audit/logging paths and multiple leads/prospects/admin API handlers.
- Repo currently has only OMX state-file modifications in git status; no application code is already dirty.
- This shell is not currently inside tmux, but omx is installed and available at /Users/money/.local/bin/omx.

Constraints

- Follow root AGENTS.md and OMX team workflow guidance.
- Keep diffs small, reviewable, and reversible.
- No new dependencies without explicit request.
- Prefer updating existing admin patterns over introducing parallel abstractions.
- Must verify before claiming completion.

Unknowns and open questions

- Whether omx team can bootstrap successfully from the current shell despite TMUX being unset.
- Which admin routes are stale, redundant, or broken relative to current backend contracts.
- Which feature areas are missing from the admin console’s navigation or command surface.
- Whether there are failing tests or type/lint issues in the current admin area before changes.

Likely codebase touchpoints

- frontend/app/admin/page.tsx
- frontend/app/admin/layout.tsx
- frontend/app/admin/**/*.tsx
- frontend/components/portal/WorkspaceCommandCenter.tsx
- frontend/lib/api*
- backend-node/src/**/admin*.ts
- backend-node/src/leads/*
- backend-node/src/audit/*
