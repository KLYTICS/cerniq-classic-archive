# `docs/handoff-incoming/` — per-commit landing entries

This directory holds landing entries that haven't yet been squashed into `docs/SESSION_HANDOFF.md` §5 Recent landings.

## Why this exists

`docs/SESSION_HANDOFF.md` is a structural hot-spot — every src commit by every peer must add a §5 bullet (enforced by `.husky/pre-commit` → `scripts/ci/check-landing-entry.mjs`). On multi-peer sessions this produces chronic stage-race absorption: peer A's SESSION_HANDOFF.md edit gets swept into peer B's commit because both peers had unstaged edits to the same file (4 such races on 2026-05-16 alone). See `[[feedback_shared_tree_git_coordination]]` in your auto-memory.

The fix: each peer writes their landing entry to its own uniquely-named file under this directory. Zero filename collisions ⇒ zero index contention ⇒ zero absorption. A periodic squash merges them into §5 in batch.

## Convention

**Filename:** `YYYY-MM-DD-<sha7>-<topic-slug>.md`

- `YYYY-MM-DD` — date of the commit
- `<sha7>` — short SHA of the commit this landing describes (write entry, commit, then rename if needed; or use a topic-slug-only filename if SHA isn't known yet)
- `<topic-slug>` — short kebab-case description (e.g. `rule-12-frontend`, `bundle-budget`, `idor-batchid-routes`)

Examples:
- `2026-05-16-8c5a640f-rule-12-frontend.md`
- `2026-05-16-bundle-budget-ratchet.md`

**Content:** the full §5 bullet text, starting with the canonical leading dash:

```markdown
- 2026-05-16 — **<title>.** <body text with **bold** subsections, file refs, SHA references, etc.> — `path/to/file1`, `path/to/file2`
```

The squash script (`scripts/squash-handoff-incoming.mjs`) prepends the file's content verbatim into §5 — what you write here is what ships.

## Workflow

1. **Write your landing**: create `docs/handoff-incoming/YYYY-MM-DD-<sha7>-<topic>.md` with your bullet content.
2. **Stage and commit alongside your code**: `git add <your-code-paths> docs/handoff-incoming/<your-file>.md && git commit --only <paths> -m "..."`. The landing-gate (`scripts/ci/check-landing-entry.mjs`) accepts incoming files as equivalent to a §5 bullet.
3. **Squash periodically** (at session end, or as a designated archivist peer): `node scripts/squash-handoff-incoming.mjs` merges all incoming files into §5 and deletes the originals. Use `--dry-run` to preview.

## Why this directory has README.md but otherwise stays empty

`README.md` is excluded from the landing-gate's accept logic (so an `npm install`-touched README doesn't accidentally pass the gate) and from the squash (so it's never merged into §5). It only exists to (a) establish the directory in git and (b) document the convention.

## Self-test

```sh
node scripts/squash-handoff-incoming.mjs --self-test
```

8 fixture cases covering: no-op, malformed input, missing §5 anchor, single-file prepend, multi-file ordering, content-trim normalization.
