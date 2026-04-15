# CerniQ — Multi-Session Coordination Protocol

> **Read this when you open a new Claude Code terminal on CerniQ.** This is how multiple interactive sessions share one working tree without clobbering each other's WIP.
>
> Last updated: 2026-04-15

---

## Why this exists

CerniQ now has **three** coordination layers. Each covers a different axis:

| Layer | Covers | Scope | Auto-wired? |
|---|---|---|---|
| **`.omx/state/team/<mission>/`** (OMX swarm) | Leader-launched worker pools with tmux + worktrees | Mission-scoped | Via OMX launcher |
| **`~/.claude/peers/` (`claude-peers` CLI)** | Cross-project peer visibility across FORGE/CerniQ/Apex/Bimba | User-global | Via SessionStart/Stop/SessionEnd hooks in `~/.claude/settings.json` |
| **`scripts/session/*` + `.omx/state/team/sessions/`** (this doc) | CerniQ-scoped claims wired into the commit pipeline (landing-gate + claim-gate) | Repo-local | Manual (`npm run session:register`) |

**When to use which:**
- **`claude-peers`** — always on. Auto-registers every Claude terminal you open; cross-project warnings fire on overlap. You mostly don't touch it.
- **`scripts/session/*`** — CerniQ-specific discipline. Use when you want (a) claims that the pre-commit claim-gate can see, (b) the `session:handoff` helper that safely appends landing bullets, (c) human-readable nicknames in repo state.

The two advisory layers run in parallel and don't interact — but the pre-commit **claim-gate reads both** to build a unified warning.

This protocol is **additive and advisory** (default warn-only). The existing pre-commit landing-gate runs unchanged. Nothing blocks unless you explicitly set `STRICT_CLAIMS=1`.

---

## 1. Session lifecycle

```
┌─────────┐   register   ┌─────────┐   claim   ┌─────────┐   release   ┌─────────┐
│ cold    │ ───────────▶ │ live    │ ────────▶ │ working │ ──────────▶ │ released│
└─────────┘              └─────────┘           └─────────┘             └─────────┘
                              │                     │                       │
                              └──── heartbeat ──────┘                       │
                                    (every tool call, register, claim)     │
                              ┌──────────────────────────────────────────── ┘
                              │   end (--end)   OR   stale after 30 min
                              ▼
                         [ session file deleted ]
```

**State lives at** `.omx/state/team/sessions/<nickname>.json`.

**Minimum lifecycle**:
```bash
# Opening a new terminal
npm run session:register -- erwin-alm

# Before editing
npm run session:claim -- erwin-alm backend-node/src/alm frontend/app/alm

# Before closing
npm run session:release -- erwin-alm --end
```

---

## 2. Nicknames

- Format: lowercase letters, digits, hyphens. 2–32 chars. Regex `^[a-z0-9][a-z0-9-]{1,31}$`.
- Use `<person>-<workstream>`: `erwin-alm`, `erwin-portal`, `reviewer`, `audit-sweep`.
- Same nickname on re-register = heartbeat refresh (normal — e.g. after a laptop reboot).

---

## 3. Conflict policy

The conflict predicate lives in one place: `pathsConflict(a, b)` in `scripts/session/_lib.mjs`.

**Current policy — strict prefix overlap (bidirectional):**

| Claim A | Claim B | Verdict |
|---|---|---|
| `backend-node/src/alm` | `backend-node/src/alm/services` | **conflict** |
| `backend-node/src/alm` | `backend-node/src/risk` | safe |
| `docs` | `docs` | **conflict** |
| `frontend/app/alm` | `frontend/app/portal` | safe |

**Why strict:** false positives cost a 5-second "ack and continue"; false negatives cost silently overwriting another terminal's uncommitted work. Strict wins.

**Softening:** edit `pathsConflict()` in `_lib.mjs`. Callers do not change. Examples of policies you might want:
- File-level claims (`pathsConflict` becomes exact-match only)
- A shared-read tag (`shared:docs` never conflicts with `shared:docs`, only with exclusive claims)
- Ignore conflicts when both sessions are on different branches

---

## 4. Heartbeat and staleness

- Every `register`, `claim`, and `release` refreshes `heartbeat_at`.
- After **30 minutes** with no heartbeat, the session is considered stale. Its claims no longer block other sessions' warnings.
- Stale sessions are hidden from `session:list` by default. Use `--all` to see them.
- `STALE_MS` lives in `_lib.mjs`. Tune if 30m feels wrong (shorter = faster recovery from crashes; longer = more tolerant of long-running tasks).

---

## 5. Commands

| Command | What it does |
|---|---|
| `npm run session:register -- <nickname>` | Mint or refresh a session |
| `npm run session:claim -- <nickname> <path>...` | Advisory claim; warns on overlap |
| `npm run session:release -- <nickname> <path>...` | Release specific paths |
| `npm run session:release -- <nickname> --all` | Release all claims, keep session |
| `npm run session:release -- <nickname> --end` | End the session (delete file) |
| `npm run session:list` | Show live sessions + claims |
| `npm run session:list -- --all` | Include stale sessions |
| `npm run session:list -- --json` | Machine-readable |
| `npm run session:status` | Unified status: this terminal + repo peers + user-global CerniQ claims |
| `npm run session:handoff -- "Title" "Body."` | Append a dated bullet under `## 5. Recent landings` in `SESSION_HANDOFF.md` |
| `npm run session:handoff -- "Title" "Body." --dry` | Show what would be appended |
| `npm run test:session` | Run the coordinator test suite (`node:test`) |

### Environment variables

| Variable | Purpose |
|---|---|
| `CERNIQ_SESSION` | Nickname of this terminal. Set once per terminal (`export CERNIQ_SESSION=erwin-alm`). Lets the claim-gate know which session is *you*. |
| `CLAUDE_PEERS_SESSION` | Session id used by the user-global `claude-peers` layer. Set automatically by the SessionStart hook. |
| `SKIP_CLAIMS=1` | Skip the claim-gate for this commit (e.g., automated rebase). |
| `STRICT_CLAIMS=1` | Turn the claim-gate from warn to block. Use on release branches. |
| `SKIP_LANDING=1` | Skip the landing-gate for non-landing commits (docs, WIP, hotfix). |

---

## 6. Relationship to existing layers

- **`docs/SESSION_HANDOFF.md`** — still the authoritative *narrative* handoff. Write a landing bullet there when you merge. This protocol coordinates *in-flight* work; the handoff coordinates *landed* work.
- **`check-landing-entry.mjs`** — unchanged. Src-path commits still require a same-day landing bullet.
- **OMX swarm under `.omx/state/team/<mission>/`** — ad-hoc sessions live at `.omx/state/team/sessions/`. The two trees are siblings and don't interact; a single OMX worker would not typically also register as an ad-hoc session.

---

## 7. Roadmap

- **Round 1 (done — 2026-04-15)**: register/claim/release/list + this doc. Advisory only.
- **Round 2 (done — 2026-04-15)**: `scripts/ci/check-claim-conflicts.mjs` wired into `.husky/pre-commit`. Reads both layers (repo `.omx/state/team/sessions/` + user-global `~/.claude/peers/claims/cerniq__*.json`). Warn-only by default (`STRICT_CLAIMS=1` to block, `SKIP_CLAIMS=1` to skip). Plus `session:status`, `session:handoff`, and `node:test` suite at `scripts/session/_lib.test.mjs` (`npm run test:session`).
- **Round 3 (maybe)**: Claude Code `PreToolUse` hook that calls `claim` automatically for Edit/Write targets, so sessions self-claim without manual steps. Would likely extend `~/.claude/settings.json` to mirror the existing `SessionStart` hook for claude-peers.

---

*See also: `docs/SESSION_HANDOFF.md`, `docs/MULTI_TERMINAL_RUNBOOK.md`, `.omx/state/team/audit-and-modernize-the-cerniq/manifest.v2.json`.*
