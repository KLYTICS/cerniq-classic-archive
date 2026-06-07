# CerniQ — Operating Instructions for Claude

> **Pickup hub: [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).** Read it first on every session. It tracks phase status, recent landings, and live decisions. AGENTS.md captures durable workspace facts.

CerniQ is a bilingual ALM (Asset-Liability Management) platform for Puerto Rico financial institutions — NestJS 11 backend + Next.js 16 frontend. Production at cerniq.io, API at api.cerniq.io.

---

## Repo shape

| Path | Role |
|---|---|
| `backend-node/` | NestJS API, Prisma schema, ALM math, COSSEC reporting |
| `frontend/` | Next.js 16 app, Bloomberg-density UI, vitest + playwright |
| `apple/` | Swift package + Xcode shell — see SESSION_HANDOFF §Apple |
| `docs/` | Architecture, ADRs, SESSION_HANDOFF, security audits |
| `scripts/swarm/` | Multi-terminal swarm dispatch (boot/dispatch/gate/audit) |
| `scripts/session/` | Cross-session register/claim/release/handoff |
| `prisma/migrations/` | Append-only — never edit applied migrations |

---

## Invariant suite (what gates a commit / PR)

**Backend** — `cd backend-node && npm run lint`:
```
eslint
→ verify:tenant-scope
→ verify:no-orphan-spec
→ verify:no-focused-tests                 (no it.only / .skip in committed specs — silent-green guard)
→ verify:d1-no-silent-fallback            (CerniQ D1 — never silent zeros; no getDemo* fallback in src/alm)
→ verify:no-silent-catch                  (CerniQ — no swallowed errors / empty catch in src/alm)
→ verify:auth-coverage                    (auth-guard coverage strict)
→ verify:rule-4-audit-immutable           (KLYTICS Rule 4 — audit_log* append-only)
→ verify:rule-9-stamping                  (KLYTICS Rule 9 — LLM prompt + cost provenance)
→ verify:rule-11-any-rationale            (KLYTICS Rule 11 — type-rationale on `any`)
→ verify:rule-12-crypto-randomness        (KLYTICS Rule 12 — crypto-grade randomness in security paths)
→ verify:gate-selftest                    (meta — runs every gate's --self-test in CI; enforces D24 #4)
→ tsc --noEmit
```
Plus `prisma validate`, `jest` (coverage floor 86/70/81/86 statements/branches/functions/lines), `nest build`.

The four KLYTICS rule verifiers live in `backend-node/scripts/verify-rule-*.mjs` and each supports `--self-test`. See `docs/platform/KLYTICS_AUDIT_DISCIPLINE.md` for normative rule text and per-rule adoption status (Rule 11 carries a 212-file chip-away baseline in `verify-rule-11-baseline.json`).

**Frontend** — `cd frontend && npm run lint`:
```
eslint → verify-alm-registry → verify-no-orphan-tests → tsc --noEmit
```
Plus `vitest run --coverage --maxWorkers=1` (floor 60/52/55/62), `next build`, optional `verify:bundle-budget` (max 1.25 MB single-route / 154.5 MB summed first-load).

**Pre-commit (husky)** — staged-file checks only:
- backend tsc incremental (warn-only)
- staged-file clean-worktree check
- backend prettier `--check` (block-only, drift fixed with `npx prettier --write`)
- landing-gate (`scripts/ci/check-landing-entry.mjs`) — `src/`/`app/`/`lib/` changes require a same-day SESSION_HANDOFF §5 entry; bypass with `SKIP_LANDING=1` only for non-landing commits (hotfix, flake, WIP)
- claim conflict advisory
- secret scan (block-only; bypass `SKIP_SECRET_SCAN=1`)

Top-level shortcut: `npm run verify:local:critical` runs the full backend + frontend + critical-e2e chain.

---

## D24 ratchet pattern

Every quality gate in this repo follows the same discipline:

1. **Measure** the current floor (or ceiling).
2. **Lock** the threshold at integer-below-current (for floors: coverage, test counts) or integer-above-current (for ceilings: bundle size, latency, allocations).
3. **Ratchet in the right direction only** — coverage thresholds only RAISE; bundle ceilings only LOWER. Loosening requires an explicit decision + a SESSION_HANDOFF §5 entry naming the reason.
4. **Embed a `--self-test`** for any new gate script so the rules themselves are verified in CI.

Examples:
- `backend-node/jest.coverageThreshold.global` — floor 86/70/81/86, ratchet up.
- `backend-node/scripts/verify-no-orphan-spec.mjs` — 8 pairing rules + 15-entry baseline list. Adding a new orphan must either: (a) pair it with source, or (b) be justified in BASELINE_ORPHANS with reason.
- `frontend/scripts/verify-bundle-budget.mjs` — ceiling 1.25 MB single-route + 154.5 MB summed, ratchet down.
- `frontend/vitest.config` coverage thresholds — floor 60/52/55/62.

---

## Branch + commit protocol

- Work branches are named `claude/<topic>`; never commit directly to `main`.
- Each landing appends a bullet to `docs/SESSION_HANDOFF.md` §5 (Recent landings). The landing-gate in `.husky/pre-commit` enforces this for `src/`, `app/`, `lib/`, `e2e/` changes.
- Pre-existing landed work is the source of truth — read git log + SESSION_HANDOFF before assuming a feature is missing.
- Never silent zeros — see SESSION_HANDOFF D1 (gaps + partial reports, never `0` for missing data, never hard 422s).
- Never raise a threshold without justification. Never disable a verifier. Never skip hooks without naming why.

---

## Shared-tree git rules (CRITICAL — multi-session coordination)

Multiple Claude sessions regularly run in this same working tree (case-insensitive APFS makes `Desktop/cerniq` ≡ `Desktop/Cerniq`). They share `.git/index`. Three failure modes have been observed and one mitigation works.

**Failure modes:**
1. `git add -A` / `git add .` / `git add :/` — sweeps peer's unstaged files into your commit. **Never use these.**
2. `git add <file> && git commit -m` — picks up the entire current index, including anything peers staged in the gap. Commit body misattributes work.
3. `git update-index --cacheinfo <blob>` mitigates peer-DISK-content-sweeping-mine, but NOT peer-COMMIT-absorbing-my-staged-blob. Partial mitigation.

**Working mitigation** — explicit pathspec at commit time:

```sh
# For tracked files (modified, not new):
git commit -m "..." -- frontend/app/foo.tsx frontend/lib/bar.ts

# For untracked-new + tracked together (commit -- pathspec rejects untracked):
git add frontend/scripts/verify-bundle-budget.mjs frontend/package.json
git commit --only frontend/scripts/verify-bundle-budget.mjs frontend/package.json -m "..."
```

`git commit --only <paths>` re-asserts the file set at commit time; it survives index churn from peer activity between your `git add` and your `git commit`. **This is the canonical pattern on this repo.**

**Caveat — `--only` is index-safe, not same-file-disk-safe.** `git commit --only <paths>` (and `commit -- <paths>`) re-reads the **working-tree content** of each named path *at commit time*. That defeats peers staging *other* files (modes 1–3 above), but it does **not** protect a hot shared file that a peer rewrites *on disk* in the gap between your last inspection and your commit — `--only` will capture the peer's freshly-written lines into your commit. Observed live: `41237e8` absorbed a peer's RC-1 §5 bullet because a peer wrote `docs/SESSION_HANDOFF.md` between a `git diff HEAD` check and the `git commit --only` (see the `chore(coord): stage-race attribution correction` entry in SESSION_HANDOFF §5). **Mitigation for hot docs** (`docs/SESSION_HANDOFF.md` especially): run the verify and the commit in the **same shell invocation**, gated on an exact added-line count, so a concurrent write aborts instead of silently landing:

```sh
ADDED=$(git diff HEAD -- docs/SESSION_HANDOFF.md | grep -cE '^\+- 2026')
[ "$ADDED" = "1" ] && git commit --only docs/SESSION_HANDOFF.md -m "..." \
  || echo "ABORT: concurrent write to the doc — re-inspect before committing"
```

**Coordination CLI** — `~/.claude/peers/bin/claude-peers`:
- `status` — see active peer claims (project + paths + age)
- `claim <name> --paths <p1>,<p2>` — register your lane (advisory; warns on overlap)
- `claim ... --read-only` — observe without triggering overlap warnings
- `msg <sid> "..."` — peer-to-peer message
- `inbox` — read unread messages
- `conflict-check` — pre-commit overlap scan
- `install-post-commit` — installs `.git/hooks/post-commit` that auto-records your commit as a decision visible to other peers

Before any meaningful work: `claude-peers status`. Before commit: `claude-peers conflict-check`. After a stage-race slips through: write a docs-only follow-up commit naming the misattributed SHA.

---

## Spawn patterns

When a task fans out across multiple read surfaces, prefer **parallel research agents** over serial reads:

```
Spawn N=3..5 Explore agents in one message, each with a focused recon prompt.
Synthesize results yourself. Then implement with explicit-path staging.
```

For implementation, **stay serial** — code edits in shared tree compound stage-race surface. Reserve agents for read-only scope-discovery work.

See `scripts/swarm/` for the multi-terminal swarm dispatch infrastructure (Vol.3/Vol.4 — boot/dispatch/gate/audit/escalate/fleet).

---

## What "done" means

A ratchet is **done** when:

1. Its self-test (or matching unit test) passes 100% — embedded fixtures, no dependency on live state.
2. Its live invocation passes against current code on the branch.
3. It's wired into a script callable from `npm run` (so CI and future Claudes find it).
4. A SESSION_HANDOFF §5 landing entry names the commit SHA.
5. The commit message explains the **why**, not just the **what**, and quotes the measured floor/ceiling so future ratcheting has a baseline.

If any of those five is missing, the work is "WIP," not "shipped."
