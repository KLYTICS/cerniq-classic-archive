# .cerniq — Between-Terminals Coordination

This directory is the substrate for the Vol.3 50-Terminal Execution Model.
If you are a Claude session working on CERNIQ, read this first.

## First command in any terminal

```bash
node scripts/cerniq-terminal.mjs status
```

This shows: overall progress (shipped/in-progress/claimed), active peer
claims, and any collisions.

## Key files

| File | Purpose |
|---|---|
| `terminals.json` | The 50-terminal registry — IDs, deps, files, sprints |
| `CONTRACTS.md` | Non-negotiables + claim protocol + LLM failure doctrine |
| `handoff/` | Per-terminal session handoff notes |

## Workflow

```
cerniq-terminal list --open        # see what's not started
cerniq-terminal deps E1            # check what blocks / what you unblock
cerniq-terminal pick E1            # claim it (writes peer claim too)
cerniq-terminal start E1           # mark in_progress
# ... do the work ...
cerniq-terminal done E1            # mark shipped + release peer claim
```

Mid-session baton pass:
```
cerniq-terminal handoff E1         # writes .cerniq/handoff/E1.md
# next session:
cerniq-terminal resume E1          # prints the handoff note
```

## Integrity

```
cerniq-terminal doctor     # validate deps, cycles, symmetry, file paths
cerniq-terminal graph      # ASCII DAG + critical path
cerniq-terminal diff       # peer claims vs. registry drift
```

## How it works with claude-peers

Every `pick` writes a `claude-peers claim` with the terminal's file paths.
Every `done` issues a `claude-peers release`. The peers status board (visible
across all terminals via `claude-peers status`) reflects what every session
is actively writing. The `diff` command detects when a peer's claimed paths
don't map to any terminal in the registry.

## Rules

1. **Don't bypass the registry.** If a file isn't in any terminal's
   write-set, it's unprotected — peers won't warn on overlap.
2. **Critical terminals (`!` in listings) take exclusive claims.** The CLI
   will refuse a second pick on the same write-set until the first releases.
3. **Doctor before shipping.** Run `doctor` to catch broken dep refs,
   cycles, or orphaned claims before marking a terminal done.
