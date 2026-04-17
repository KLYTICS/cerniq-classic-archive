#!/usr/bin/env node
/**
 * check-bundle-size.mjs — CI gate for frontend JavaScript weight.
 *
 * Rationale
 *   Frontend bundle weight affects TTI (time-to-interactive) on every
 *   customer's first visit. A 3MB bundle on a 4G connection is ~6s of
 *   download before the app starts. Enterprise customers on restricted
 *   networks (corporate Wi-Fi, banking VPN) feel this most. The SLO
 *   doc (docs/ops/SLO.md) commits to TTFB < 800ms; if the bundle
 *   itself is 5MB, that's already spent before any render happens.
 *
 *   This gate sits AFTER `next build` in CI and measures the total
 *   size of emitted JS chunks. Regressions that push total JS above
 *   the ceiling fail the build.
 *
 * Ceilings (gzipped-like estimate via raw size × 0.3)
 *   TOTAL raw JS   : 10 MB   — all chunks together, no gzip
 *   TOTAL estimated: 3 MB gz — raw × 0.3 (typical text compression)
 *   LARGEST chunk  : 1.5 MB  — any single chunk shouldn't dominate
 *
 * Tuning
 *   The ceilings are generous today because the app hauls in Recharts,
 *   Monaco (for JSON editors), and the full lucide-react icon set. As
 *   we add code-splitting we should TIGHTEN these. Raising a ceiling
 *   requires a comment in this file explaining why.
 *
 * Invocation
 *   cd frontend && npm run build && node ../scripts/ci/check-bundle-size.mjs
 *
 * Exit codes
 *   0 — under ceiling
 *   1 — regression (exceeds ceiling) OR missing build output
 */

import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const CHUNKS_DIR = join(REPO_ROOT, 'frontend', '.next', 'static', 'chunks');

// Ceilings (bytes). Change only with justification comment.
const CEILING_TOTAL_RAW = 10 * 1024 * 1024; // 10 MB
const CEILING_LARGEST = 1.5 * 1024 * 1024; //  1.5 MB
const GZIP_RATIO = 0.3; // rough estimate for minified JS

function* walkJsFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsFiles(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield full;
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function main() {
  const files = Array.from(walkJsFiles(CHUNKS_DIR));

  if (files.length === 0) {
    console.error(
      `::error title=Bundle Check::No JS chunks found at ${CHUNKS_DIR}. ` +
        `Did you run 'next build' first?`,
    );
    process.exit(1);
  }

  const sizes = files
    .map((f) => ({ file: f.replace(REPO_ROOT + '/', ''), size: statSync(f).size }))
    .sort((a, b) => b.size - a.size);

  const total = sizes.reduce((acc, { size }) => acc + size, 0);
  const largest = sizes[0];

  console.log('');
  console.log('Frontend bundle size report:');
  console.log('  Chunks scanned :', files.length);
  console.log('  Total raw     :', formatBytes(total));
  console.log('  Total est. gz :', formatBytes(total * GZIP_RATIO));
  console.log('  Largest chunk :', formatBytes(largest.size), '—', largest.file.split('/').pop());
  console.log('');
  console.log('Top 5 chunks:');
  for (const { file, size } of sizes.slice(0, 5)) {
    console.log('  ', formatBytes(size).padStart(10), file.split('/').pop());
  }
  console.log('');

  let violations = 0;

  if (total > CEILING_TOTAL_RAW) {
    console.error(
      `::error title=Bundle Size Regression::Total raw JS ${formatBytes(total)} ` +
        `exceeds ceiling ${formatBytes(CEILING_TOTAL_RAW)}. ` +
        `Review recent additions for heavy dependencies (recharts, monaco, ` +
        `lucide) and split with next/dynamic where possible.`,
    );
    violations++;
  }

  if (largest.size > CEILING_LARGEST) {
    console.error(
      `::error title=Single Chunk Too Large::Largest chunk ${formatBytes(largest.size)} ` +
        `(${largest.file}) exceeds ceiling ${formatBytes(CEILING_LARGEST)}. ` +
        `A single large chunk likely indicates a heavy module loaded eagerly; ` +
        `consider code-splitting with dynamic import.`,
    );
    violations++;
  }

  if (violations > 0) {
    console.error('');
    console.error(`Bundle check FAILED (${violations} violation(s))`);
    console.error('');
    console.error('To tighten the budget (preferred) or raise a ceiling:');
    console.error('  1. Review frontend/next.config.ts + package.json for recent deps');
    console.error('  2. Run `npm run build -- --debug` for chunk origin detail');
    console.error('  3. If the growth is warranted, update ceilings in this file');
    console.error('     with a comment explaining why + the approving reviewer.');
    process.exit(1);
  }

  console.log('Bundle check PASSED');
  process.exit(0);
}

main();
