# CERNIQ · Between-Terminals Contract

The 50-terminal execution model (Vol.3) is a parallel-work substrate.
This document is the contract every terminal — human or Claude — honors
when it claims, works, and hands off.

## The four non-negotiables (Vol.2, enforced here)

1. **AUDIT FIRST** — every agent action is logged **before** it is taken.
   Audit write failure = run fails. No silent swallow.
2. **TOOL TRUST** — no number in agent output without a matching tool call
   in the audit chain. Output validator enforces this post-run.
3. **MULTI-TENANT ISOLATION** — every read/write scoped to `institutionId`;
   RLS enforces at the DB layer (F2).
4. **GRACEFUL DEGRADATION** — a swarm sub-model failure reduces confidence,
   never crashes the run.

Violating any of these is a Severity-1 incident.

## Claim protocol

Each terminal owns a **write-set** (`files`) and a **read-set** (`reads`).
Two defaults:

- **Advisory claim (default for most terminals):** `cerniq-terminal pick <id>`
  warns on write-set overlap with a peer claim but does not block. This is how
  `claude-peers` behaves today; it is the right default because false blocks
  kill velocity.
- **Exclusive claim (`"critical": true` terminals only):** the CLI refuses
  a second claim on the same write-set until the first releases. This protects
  the files listed below under *Critical files*.

`cerniq-terminal` is a thin wrapper around `claude-peers claim`; every pick
writes a peers claim with `--paths <files>` so the entire `~/.claude/peers/`
status board reflects the per-terminal ownership. A cross-terminal observer
(e.g. this repo's `scripts/cerniq-cross.mjs`) can then surface collisions
across git worktrees as well.

### Critical files (exclusive)

Files whose consistency is load-bearing for the audit guarantee or tenant
isolation. Any terminal writing these gets an exclusive claim.

- `backend-node/prisma/schema.prisma` — agent schema + hash-chain invariants
- `backend-node/src/agents/runner/agent-audit-logger.service.ts` — audit invariant
- `backend-node/src/agents/runner/agent-runner.service.ts` — tool-use loop state machine
- `backend-node/src/agents/registry/tool-registry.service.ts` — tenant routing
- `backend-node/src/agents/api/agent-scope.guard.ts` — institution scope
- `backend-node/prisma/migrations/**` — any migration

## Agent chaining transport

When `ALM_DECISION` completes and `COMMITTEE_REPORT` wants to consume it,
the transport is **asynchronous via Bull**: the parent emits
`agent:completed`, a dispatcher enqueues the child with
`triggerKind=CHAIN`, `triggerRef=<parentRunId>`, and a fresh `idempotencyKey`
of `sha256(parentRunId || childAgentId)`. This keeps every agent its own
transactional unit — essential for the AUDIT FIRST invariant.

Synchronous "child inside parent's job" chaining is banned: a crash in the
child would leave the parent's audit chain inconsistent.

## LLM failure policy

Mid-run Anthropic failures:

- **5xx / 429:** retry with exponential backoff (250ms, 500ms, 1s, max 3)
- **4xx (except 429):** fail-fast — these are prompt/tool-schema bugs
- **Timeout (>agent.timeoutMs):** abort → run status `TIMED_OUT`

We do **not** resume from the last audit-log step. Replaying from run start
is safer than reconstructing state, and the idempotency key ensures the new
run short-circuits to the existing record where equivalent.

## Definition of done (per terminal)

A terminal is `shipped` only when **all** of these hold:

- [ ] File compiles (`tsc --noEmit` for TS, `prisma validate` for schema)
- [ ] Unit tests pass (`pnpm --filter backend-node test -- --findRelatedTests <file>`)
- [ ] The terminal's `reads` are at compatible contract versions
- [ ] No new call to `any`, `@ts-ignore`, or un-awaited promise
- [ ] If critical: `cerniq-terminal status` shows no overlapping claims from peers

## Claim lifecycle

```
not_started → claimed → in_progress → shipped
                ↑          ↓
                └── released
```

- `cerniq-terminal pick <id>`   → claimed + peers claim created
- `cerniq-terminal start <id>`  → in_progress
- `cerniq-terminal done <id>`   → shipped + peers release
- `cerniq-terminal release <id>`→ back to not_started (released peers claim)

## Handoff

When you end a session mid-terminal, run `cerniq-terminal handoff <id>` to:

1. Append a line to `docs/SESSION_HANDOFF.md` with current progress
2. Keep the peers claim alive (TTL bumped) so the next session sees it
3. Write a resumable note into `.cerniq/handoff/<id>.md`

The next session runs `cerniq-terminal resume <id>` to pick up the baton.
