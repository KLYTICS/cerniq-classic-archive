#!/usr/bin/env node
// scripts/squash-handoff-incoming.mjs
//
// Squash docs/handoff-incoming/*.md files into docs/SESSION_HANDOFF.md
// §5 in batch. Companion to scripts/ci/check-landing-entry.mjs Form (2):
// peers write per-commit landing entries to unique-named incoming files
// (zero contention with concurrent peers), then any peer (or an
// archivist peer running on a cadence) merges them into the central
// §5 index here.
//
// File convention (enforced loosely — script accepts any *.md file):
//   docs/handoff-incoming/YYYY-MM-DD-<sha7>-<topic-slug>.md
//
// Each incoming file's content IS the bullet, starting with the
// canonical leading dash:
//   - 2026-05-16 — **Title.** Body text … — `file/paths`
//
// Squash order: filename DESCENDING (newest first, matching §5's
// most-recent-on-top convention). With ISO-date-prefixed filenames,
// lexicographic descending equals chronological descending.
//
// Flags:
//   --dry-run     show what would happen without modifying anything
//   --self-test   run embedded fixture cases against the pure squash() function
//
// Exit codes:
//   0 — success (or no-op when no incoming files)
//   1 — error (missing §5 anchor, malformed input, etc.)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const HANDOFF = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');
const INCOMING_DIR = join(REPO_ROOT, 'docs', 'handoff-incoming');

const SECTION_ANCHOR = '## 5. Recent landings';

const ANSI = {
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Pure squash function — no I/O.
 * @param {string} handoffText - current SESSION_HANDOFF.md contents
 * @param {Array<{name: string, content: string}>} incomingFiles - sorted DESC by filename (newest first)
 * @returns {{ok: boolean, newHandoffText?: string, error?: string, prependedCount?: number}}
 */
export function squash(handoffText, incomingFiles) {
  if (typeof handoffText !== 'string') {
    return { ok: false, error: 'handoffText must be a string' };
  }
  if (!Array.isArray(incomingFiles)) {
    return { ok: false, error: 'incomingFiles must be an array' };
  }
  if (incomingFiles.length === 0) {
    return { ok: true, newHandoffText: handoffText, prependedCount: 0 };
  }

  // Line-anchored match — a substring indexOf would also match in-text references
  // to the anchor (e.g. a checkbox item that names "## 5. Recent landings" inside
  // backticks). Without line anchoring, the squash inserts after the FIRST occurrence
  // — which can be a paragraph mention rather than the actual heading. The `m` flag
  // makes `^` and `$` line-anchors; `\s*$` tolerates trailing whitespace on the
  // heading line.
  const anchorRe = new RegExp(
    `^${SECTION_ANCHOR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'm',
  );
  const anchorMatch = anchorRe.exec(handoffText);
  if (!anchorMatch) {
    return { ok: false, error: `anchor "${SECTION_ANCHOR}" not found in handoff text` };
  }
  const anchorIdx = anchorMatch.index;

  // Position after the anchor line + its trailing blank line.
  const afterAnchor = handoffText.indexOf('\n', anchorIdx);
  if (afterAnchor === -1) {
    return { ok: false, error: 'anchor line has no terminating newline' };
  }
  // Skip one optional blank line after the anchor.
  let insertPos = afterAnchor + 1;
  if (handoffText[insertPos] === '\n') insertPos += 1;

  // Validate each incoming bullet starts with the canonical "- YYYY-MM-DD — **"
  // pattern (loose match — accepts any "- " prefix to be forgiving).
  for (const f of incomingFiles) {
    if (typeof f?.name !== 'string' || typeof f?.content !== 'string') {
      return { ok: false, error: `malformed entry: ${JSON.stringify(f).slice(0, 80)}` };
    }
    if (!f.content.trimStart().startsWith('- ')) {
      return {
        ok: false,
        error: `${f.name}: content must start with "- " (canonical bullet form). Got: ${f.content.slice(0, 60).replace(/\n/g, '\\n')}…`,
      };
    }
  }

  // Build the prepended block. Each incoming file becomes its own bullet,
  // separated by blank lines (matching §5's existing visual rhythm).
  const block = incomingFiles
    .map((f) => f.content.trimEnd())
    .join('\n\n') + '\n\n';

  const newHandoffText =
    handoffText.slice(0, insertPos) + block + handoffText.slice(insertPos);

  return { ok: true, newHandoffText, prependedCount: incomingFiles.length };
}

function listIncomingFiles() {
  if (!existsSync(INCOMING_DIR)) return [];
  const entries = readdirSync(INCOMING_DIR)
    .filter((n) => n.endsWith('.md') && n !== 'README.md')
    .sort()
    .reverse(); // DESC = newest first (assuming ISO-date prefix)
  return entries.map((name) => ({
    name,
    fullPath: join(INCOMING_DIR, name),
    content: readFileSync(join(INCOMING_DIR, name), 'utf8'),
  }));
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const files = listIncomingFiles();

  if (files.length === 0) {
    console.log(ANSI.dim('squash-handoff-incoming: no files in docs/handoff-incoming/'));
    process.exit(0);
  }

  if (!existsSync(HANDOFF)) {
    console.error(ANSI.red(`✗ docs/SESSION_HANDOFF.md not found at ${HANDOFF}`));
    process.exit(1);
  }
  const handoffText = readFileSync(HANDOFF, 'utf8');

  const result = squash(handoffText, files);
  if (!result.ok) {
    console.error(ANSI.red(`✗ squash failed: ${result.error}`));
    process.exit(1);
  }

  console.log(
    `squash-handoff-incoming: ${ANSI.bold(result.prependedCount)} file(s) ready to merge`,
  );
  for (const f of files) {
    const firstLine = f.content.split('\n')[0].slice(0, 100);
    console.log(`  ${ANSI.dim('→')} ${f.name}`);
    console.log(`    ${ANSI.dim(firstLine)}${f.content.split('\n')[0].length > 100 ? '…' : ''}`);
  }

  if (dryRun) {
    console.log(ANSI.dim('\n--dry-run: no files modified, no files deleted'));
    process.exit(0);
  }

  writeFileSync(HANDOFF, result.newHandoffText, 'utf8');
  for (const f of files) {
    unlinkSync(f.fullPath);
  }

  console.log(
    ANSI.green(`\n✓ prepended ${result.prependedCount} entry/entries to §5 + deleted ${result.prependedCount} incoming file(s)`),
  );
  console.log(
    ANSI.dim('  next: stage and commit — `git add docs/SESSION_HANDOFF.md docs/handoff-incoming/ && git commit -m "docs(handoff): squash N incoming entries"`'),
  );
}

// ─── Self-test ─────────────────────────────────────────────────────────
function selfTest() {
  const baseHandoff = [
    'Header lines.',
    '',
    '## 4. Prior',
    '',
    '## 5. Recent landings',
    '',
    '- 2026-05-16 — **prior entry from earlier today.** body … — `path/to/file.ts`',
    '',
  ].join('\n');

  const cases = [
    {
      name: 'no incoming files → no-op',
      handoff: baseHandoff,
      incoming: [],
      expect: { ok: true, prependedCount: 0, newHandoffEquals: baseHandoff },
    },
    {
      name: 'malformed entry (missing name) → error',
      handoff: baseHandoff,
      incoming: [{ content: '- 2026-05-16 — **x.** body' }],
      expect: { ok: false },
    },
    {
      name: 'malformed entry (missing content) → error',
      handoff: baseHandoff,
      incoming: [{ name: '2026-05-16-abc.md' }],
      expect: { ok: false },
    },
    {
      name: 'content not starting with "- " → error',
      handoff: baseHandoff,
      incoming: [{ name: '2026-05-16-abc.md', content: '2026-05-16 — wrong format' }],
      expect: { ok: false },
    },
    {
      name: 'missing §5 anchor → error',
      handoff: 'No section 5 here.',
      incoming: [{ name: '2026-05-16-abc.md', content: '- 2026-05-16 — **x.** body' }],
      expect: { ok: false },
    },
    {
      name: 'single incoming prepends to §5 newest-first',
      handoff: baseHandoff,
      incoming: [{ name: '2026-05-16-newer.md', content: '- 2026-05-16 — **newer.** body — `path/to/x.ts`' }],
      expect: {
        ok: true,
        prependedCount: 1,
        anchorPositioning: 'newer-before-prior',
      },
    },
    {
      name: 'three incoming prepend in given order (caller sorts)',
      handoff: baseHandoff,
      incoming: [
        { name: '2026-05-16-c.md', content: '- 2026-05-16 — **c.** body — `c.ts`' },
        { name: '2026-05-16-b.md', content: '- 2026-05-16 — **b.** body — `b.ts`' },
        { name: '2026-05-16-a.md', content: '- 2026-05-16 — **a.** body — `a.ts`' },
      ],
      expect: { ok: true, prependedCount: 3, ordering: ['c', 'b', 'a', 'prior entry'] },
    },
    {
      name: 'incoming content with trailing newline normalizes',
      handoff: baseHandoff,
      incoming: [{ name: '2026-05-16-x.md', content: '- 2026-05-16 — **x.** body\n\n\n' }],
      expect: { ok: true, prependedCount: 1, noTripleNewlines: true },
    },
    {
      // Regression-lock: real SESSION_HANDOFF.md has a Phase-4 checkbox that mentions
      // "## 5. Recent landings" inside backticks. A substring indexOf would match THAT
      // line and insert bullets in the wrong section. Line-anchored regex must match
      // only the real heading. The MARKER line sits between the in-text reference and
      // the actual heading — with the bug, the new bullet lands BEFORE MARKER (between
      // checkbox and MARKER); after the fix, it lands AFTER MARKER (in real §5).
      name: 'in-text anchor reference (inside checkbox backticks) must NOT match — line-anchored only',
      handoff: [
        'Header.',
        '',
        '## 4. Phase',
        '',
        '- [x] Append to `## 5. Recent landings` below — enforced by hook.',
        '',
        '## 4.5 MARKER between reference and real heading',
        '',
        '## 5. Recent landings',
        '',
        '- 2026-05-16 — **prior.** body — `path/to/file.ts`',
        '',
      ].join('\n'),
      incoming: [{ name: '2026-05-16-newer.md', content: '- 2026-05-16 — **newer.** body — `x.ts`' }],
      expect: {
        ok: true,
        prependedCount: 1,
        ordering: ['Append to', 'MARKER', 'newer', 'prior'],
      },
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = squash(c.handoff, c.incoming);
    let ok = true;
    let reason = '';

    if (got.ok !== c.expect.ok) {
      ok = false;
      reason = `ok: expected ${c.expect.ok}, got ${got.ok}${got.error ? ' (' + got.error + ')' : ''}`;
    }
    if (ok && c.expect.prependedCount !== undefined && got.prependedCount !== c.expect.prependedCount) {
      ok = false;
      reason = `prependedCount: expected ${c.expect.prependedCount}, got ${got.prependedCount}`;
    }
    if (ok && c.expect.newHandoffEquals !== undefined && got.newHandoffText !== c.expect.newHandoffEquals) {
      ok = false;
      reason = `newHandoffText: not equal to expected`;
    }
    if (ok && c.expect.anchorPositioning === 'newer-before-prior') {
      const newerIdx = got.newHandoffText.indexOf('**newer.**');
      const priorIdx = got.newHandoffText.indexOf('prior entry');
      if (newerIdx === -1 || priorIdx === -1 || newerIdx >= priorIdx) {
        ok = false;
        reason = `expected newer (idx=${newerIdx}) before prior (idx=${priorIdx})`;
      }
    }
    if (ok && c.expect.ordering) {
      const positions = c.expect.ordering.map((m) => {
        const bolded = got.newHandoffText.indexOf(`**${m}.**`);
        return bolded !== -1 ? bolded : got.newHandoffText.indexOf(m);
      });
      for (let i = 0; i < positions.length - 1; i++) {
        if (positions[i] === -1 || positions[i + 1] === -1 || positions[i] >= positions[i + 1]) {
          ok = false;
          reason = `ordering broken at ${i}: ${c.expect.ordering[i]} (${positions[i]}) should precede ${c.expect.ordering[i + 1]} (${positions[i + 1]})`;
          break;
        }
      }
    }
    if (ok && c.expect.noTripleNewlines && /\n\n\n/.test(got.newHandoffText)) {
      ok = false;
      reason = 'newHandoffText contains triple newline (\\n\\n\\n) — entries not trim-normalized';
    }

    if (ok) {
      console.log(ANSI.green(`✓ ${c.name}`));
    } else {
      console.log(ANSI.red(`✗ ${c.name}`));
      console.log(`  ${reason}`);
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error(ANSI.red(`\n${failed}/${cases.length} self-test cases failed`));
    process.exit(1);
  }
  console.log(ANSI.green(`\n${cases.length}/${cases.length} self-test cases passed`));
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  main();
}
