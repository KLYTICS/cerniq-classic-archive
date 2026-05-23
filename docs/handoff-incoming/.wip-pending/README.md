# `.wip-pending/` — quarantined handoff entries

These entries describe work that was **not yet committed** at quarantine time. They were moved here so the canonical squash (`scripts/squash-handoff-incoming.mjs`) does not write false history into `docs/SESSION_HANDOFF.md` §5.

The squash script reads `docs/handoff-incoming/` flat (no recursion), so dot-prefixed subfolders like this one are safely ignored.

## Resolution path

For each file here, the owning peer should either:

1. **Commit the work** referenced in the entry (with explicit pathspec per the shared-tree rules in `CLAUDE.md`), then `mv` the entry back to `docs/handoff-incoming/` so the next squash picks it up.
2. **Delete the entry** if the work is no longer wanted (and clean up the working-tree files it references).

## Cross-session decision record

Quarantine performed under decision `a48627fe` (`~/.claude/peers/decisions.jsonl`). Reason: handoff entries here referenced files that exist in no commit on any of 13 active branches/worktrees — caught by cross-checking the entries' file references against `git log --all`.

Future-proofing idea recorded in the same investigation: a `verify-handoff-honesty.mjs` ratchet that grep-validates incoming entries' file references against `git ls-files` would catch this class of drift at write-time rather than at squash-time.
