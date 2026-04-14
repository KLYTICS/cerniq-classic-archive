#!/usr/bin/env node
// scripts/cerniq-status.mjs
// Operator status board. Parses docs/SESSION_HANDOFF.md and prints
// phase progress + freshness signal. Closes Phase 4 checklist item.
// No runtime deps — fast enough to run on every shell open.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const HANDOFF_PATH = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');
const STALE_DAYS = 7;

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  grey: '\x1b[90m',
};

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, s) => (tty ? `${C[color]}${s}${C.reset}` : s);

function fail(msg) {
  console.error(c('red', `cerniq:status — ${msg}`));
  process.exit(2);
}

if (!existsSync(HANDOFF_PATH)) {
  fail(`handoff not found at ${HANDOFF_PATH}`);
}

const raw = readFileSync(HANDOFF_PATH, 'utf8');
const lines = raw.split('\n');

// Parse "Last updated: YYYY-MM-DD (note)" from header.
const lastUpdatedMatch = raw.match(/^Last updated:\s*(\d{4}-\d{2}-\d{2})(.*)$/m);
const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : null;
const lastUpdatedNote = lastUpdatedMatch ? lastUpdatedMatch[2].trim() : '';

// Walk lines, gather phases (### Phase …) and their checkbox counts.
const phases = [];
let current = null;
for (const line of lines) {
  const phaseMatch = line.match(/^###\s+(Phase[^-\n]*(?:—[^\n]*)?)\s*$/);
  if (phaseMatch) {
    if (current) phases.push(current);
    current = {
      title: phaseMatch[1].trim(),
      done: 0,
      open: 0,
      openItems: [],
    };
    continue;
  }
  if (!current) continue;
  // Stop collecting at the next top-level section.
  if (/^##\s/.test(line) && !/^###\s/.test(line)) {
    phases.push(current);
    current = null;
    continue;
  }
  const doneMatch = line.match(/^\s*-\s*\[x\]\s+(.*)$/i);
  const openMatch = line.match(/^\s*-\s*\[\s\]\s+(.*)$/);
  if (doneMatch) current.done += 1;
  else if (openMatch) {
    current.open += 1;
    // First ~80 chars of the open item, stripped of bold/backticks.
    const summary = openMatch[1].replace(/[`*]/g, '').slice(0, 100);
    current.openItems.push(summary);
  }
}
if (current) phases.push(current);

// Parse the latest "Recent landings" date.
const landingDates = [];
const landingRegex = /^-\s+(\d{4}-\d{2}-\d{2})\s+—/gm;
let lm;
while ((lm = landingRegex.exec(raw)) !== null) {
  landingDates.push(lm[1]);
}
const latestLanding = landingDates.sort().slice(-1)[0] || null;

// Freshness check.
const daysSince = (iso) => {
  if (!iso) return Infinity;
  const then = new Date(iso + 'T00:00:00Z').getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
};
const freshnessDays = daysSince(lastUpdated);
const landingFreshnessDays = daysSince(latestLanding);
const isStale = freshnessDays > STALE_DAYS;

// Totals.
const totals = phases.reduce(
  (acc, p) => {
    acc.done += p.done;
    acc.open += p.open;
    return acc;
  },
  { done: 0, open: 0 },
);
const totalItems = totals.done + totals.open;
const percent =
  totalItems === 0 ? 100 : Math.round((totals.done / totalItems) * 100);

// Render.
const bar = (pct, width = 30) => {
  const filled = Math.round((pct / 100) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
};
const pctColor = (pct) =>
  pct >= 90 ? 'green' : pct >= 60 ? 'cyan' : pct >= 30 ? 'yellow' : 'red';

console.log('');
console.log(c('bold', 'CerniQ — Session Handoff Status'));
console.log(c('grey', '─'.repeat(60)));
console.log(
  `Last updated : ${c('bold', lastUpdated ?? 'unknown')} ${
    lastUpdatedNote ? c('grey', lastUpdatedNote) : ''
  }`,
);
console.log(
  `Latest landing: ${c('bold', latestLanding ?? 'none')}  ${c(
    'grey',
    `(${landingFreshnessDays === Infinity ? 'n/a' : landingFreshnessDays + 'd ago'})`,
  )}`,
);
console.log(
  `Freshness    : ${
    isStale
      ? c('yellow', `⚠ stale (${freshnessDays}d since last-updated, threshold ${STALE_DAYS}d)`)
      : c('green', `✓ fresh (${freshnessDays}d since last-updated)`)
  }`,
);
console.log(
  `Overall      : ${c(pctColor(percent), `${bar(percent)} ${percent}%`)} ${c(
    'grey',
    `(${totals.done}/${totalItems} items)`,
  )}`,
);
console.log('');

for (const p of phases) {
  const total = p.done + p.open;
  const pct = total === 0 ? 100 : Math.round((p.done / total) * 100);
  const marker = p.open === 0 ? c('green', '●') : c('yellow', '○');
  console.log(
    `${marker} ${c('bold', p.title.padEnd(62))} ${c(
      pctColor(pct),
      `${String(pct).padStart(3)}%`,
    )}  ${c('grey', `${p.done}/${total}`)}`,
  );
  if (p.open > 0 && process.argv.includes('--verbose')) {
    for (const item of p.openItems) {
      console.log(c('grey', `    · ${item}`));
    }
  }
}

console.log('');
console.log(
  c(
    'grey',
    `Tip: ${c('reset', 'pnpm cerniq:status --verbose')}${c(
      'grey',
      ' to list every open checkbox.',
    )}`,
  ),
);
console.log('');

// Exit non-zero if handoff freshness is past the threshold — lets CI gate on it.
process.exit(isStale ? 1 : 0);
