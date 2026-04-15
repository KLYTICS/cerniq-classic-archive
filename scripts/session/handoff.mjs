#!/usr/bin/env node
// scripts/session/handoff.mjs
//
// Append a dated landing bullet to docs/SESSION_HANDOFF.md under
// `## 5. Recent landings`. Matches the exact format enforced by
// scripts/ci/check-landing-entry.mjs:
//
//     - YYYY-MM-DD — **Title.** Body text.
//
// This closes the loop: a session can both claim paths (session:claim) and
// land work (session:handoff) without hand-editing markdown.
//
// Usage:
//   npm run session:handoff -- "Landing title" "Body describing what shipped."
//
// Options:
//   --date YYYY-MM-DD   override today's date (rarely needed)
//   --dry               print what would be appended, don't write
//
// Exit codes:
//   0 — bullet appended (or would be, in --dry)
//   1 — invalid args, handoff file missing, or landing section not found

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const HANDOFF = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const args = process.argv.slice(2);
let date = new Date().toISOString().slice(0, 10);
let dry = false;
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry') dry = true;
  else if (args[i] === '--date') date = args[++i];
  else positional.push(args[i]);
}

const [title, ...bodyParts] = positional;
const body = bodyParts.join(' ').trim();

if (!title || !body) {
  console.error(C.red('session:handoff') + ' — title and body required');
  console.error('  usage: ' + C.cyan('npm run session:handoff -- "Title" "Body text"'));
  console.error('  ' + C.gray('matches:  - YYYY-MM-DD — **Title.** Body.'));
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(C.red('session:handoff') + ` — invalid --date '${date}' (expect YYYY-MM-DD)`);
  process.exit(1);
}

if (!existsSync(HANDOFF)) {
  console.error(C.red('session:handoff') + ` — ${HANDOFF} not found`);
  process.exit(1);
}

const raw = readFileSync(HANDOFF, 'utf8');

// Find the "## 5. Recent landings" section. We insert immediately after the
// header line. The landing-gate regex is anchored at start of line, so we
// prepend our bullet above any existing bullets (reverse chronological).
const headerRe = /^(## 5\. Recent landings[^\n]*)\n/m;
const match = raw.match(headerRe);
if (!match) {
  console.error(C.red('session:handoff') + ' — no "## 5. Recent landings" section in SESSION_HANDOFF.md');
  console.error(C.gray('  Add the section header first, then re-run.'));
  process.exit(1);
}

// Ensure title ends with a period before the closing **. Landing-gate regex
// is `^-\s+YYYY-MM-DD\s+—\s+\*\*` — it only checks the date/prefix, but the
// convention is that the bolded title ends in a period. We normalize for
// consistency without being pedantic.
const titleClean = title.trim().replace(/[.\s]+$/, '') + '.';
const bullet = `- ${date} — **${titleClean}** ${body}\n`;

const insertAt = match.index + match[0].length;
const next = raw.slice(0, insertAt) + bullet + raw.slice(insertAt);

if (dry) {
  console.log(C.gray('dry run — would append:'));
  console.log(C.cyan(bullet.trimEnd()));
  process.exit(0);
}

writeFileSync(HANDOFF, next, 'utf8');
console.log(C.green('✓ appended') + ' landing bullet to ' + C.bold('docs/SESSION_HANDOFF.md'));
console.log('  ' + C.cyan(bullet.trimEnd()));
console.log('');
console.log(C.gray('  stage it: ') + 'git add docs/SESSION_HANDOFF.md');
