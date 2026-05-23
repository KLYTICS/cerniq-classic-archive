#!/usr/bin/env node
// scripts/verify-vendor-registry.mjs
//
// KLYTICS vendor registry consistency lock.
//
// The vendor registry (`src/vendor/registry.ts`) declares 17+ financial
// vendors with metadata + an optional `providerPath` pointing to a real
// provider file. When a peer refactor renames a provider file, the
// registry can silently rot — pointing at a path that no longer exists.
// The /admin/vendor-status page then renders a stale provider claim,
// and operators get misled about what's actually wired.
//
// This verifier walks the registry and asserts:
//   1. Every entry with `providerPath` points to a file that exists.
//   2. Every entry with status='production' or status='beta' HAS a
//      providerPath (you can't be production without source code).
//   3. Every entry with status='scaffold' has a documented `blockedBy`
//      reason (so the chip-away surface is actionable).
//   4. No two entries share the same `id`.
//
// Exit codes:
//   0 — registry clean
//   1 — violation found
//
// Embed `--self-test` flag follows the project D24-ratchet convention so
// CI verifies the verifier itself before trusting it.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const REGISTRY_FILE = join(SRC_ROOT, 'vendor/registry.ts');

const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');

/**
 * Crude parser — the registry is a plain TypeScript array literal with
 * one object per entry. We don't need a full TS parser; regex-scan for
 * each entry's id / status / providerPath / blockedBy fields.
 * This is fine because the registry is hand-written, has stable shape,
 * and is verified per-commit anyway. If shape ever drifts to dynamic
 * generation, swap this for a real ts-morph or @typescript/transform pass.
 */
function parseRegistry(source) {
  const entries = [];
  // Match { ... } blocks at top level inside VENDOR_REGISTRY array
  // by tracking brace depth. Skip until we hit `VENDOR_REGISTRY = [`.
  // Anchor on the actual export declaration, not on stray comment refs.
  const declMatch = source.match(
    /export\s+const\s+VENDOR_REGISTRY\b[^=]*=\s*\[/,
  );
  if (!declMatch || declMatch.index === undefined) return null;
  const arrayStart = declMatch.index + declMatch[0].length - 1; // index of the '['

  let depth = 0;
  let inEntry = false;
  let entryStart = 0;
  for (let i = arrayStart; i < source.length; i++) {
    const c = source[i];
    if (c === '{') {
      if (depth === 0 && !inEntry) {
        inEntry = true;
        entryStart = i;
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && inEntry) {
        const body = source.slice(entryStart, i + 1);
        const id = body.match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
        const status = body.match(/\bstatus:\s*['"]([^'"]+)['"]/)?.[1];
        const providerPath = body.match(
          /\bproviderPath:\s*['"]([^'"]+)['"]/,
        )?.[1];
        const hasBlockedBy = /\bblockedBy:\s*['"]/.test(body);
        if (id) entries.push({ id, status, providerPath, hasBlockedBy });
        inEntry = false;
      }
    } else if (c === ']' && depth === 0) {
      break;
    }
  }
  return entries;
}

function checkRegistry(entries) {
  const violations = [];
  const ids = new Set();

  for (const e of entries) {
    // (4) Duplicate-id check
    if (ids.has(e.id)) {
      violations.push(`duplicate vendor id: ${e.id}`);
    }
    ids.add(e.id);

    // (1) providerPath points to a real file (when defined)
    if (e.providerPath) {
      const fullPath = join(SRC_ROOT, e.providerPath);
      if (!existsSync(fullPath)) {
        violations.push(
          `${e.id}: providerPath '${e.providerPath}' does not exist on disk`,
        );
      }
    }

    // (2) production/beta MUST have a providerPath
    if ((e.status === 'production' || e.status === 'beta') && !e.providerPath) {
      violations.push(
        `${e.id}: status='${e.status}' but no providerPath declared`,
      );
    }

    // (3) scaffold MUST have a blockedBy reason
    if (e.status === 'scaffold' && !e.hasBlockedBy) {
      violations.push(
        `${e.id}: status='scaffold' but no blockedBy reason declared`,
      );
    }
  }

  return violations;
}

function selfTest() {
  const fixtures = [
    {
      name: 'detects missing providerPath on production entry',
      input: [
        {
          id: 'x',
          status: 'production',
          providerPath: null,
          hasBlockedBy: false,
        },
      ],
      expectViolation: true,
    },
    {
      name: 'detects duplicate id',
      input: [
        { id: 'x', status: 'planned', providerPath: null, hasBlockedBy: false },
        { id: 'x', status: 'planned', providerPath: null, hasBlockedBy: false },
      ],
      expectViolation: true,
    },
    {
      name: 'detects scaffold without blockedBy',
      input: [
        {
          id: 'x',
          status: 'scaffold',
          providerPath: null,
          hasBlockedBy: false,
        },
      ],
      expectViolation: true,
    },
    {
      name: 'passes valid planned entry',
      input: [
        { id: 'x', status: 'planned', providerPath: null, hasBlockedBy: false },
      ],
      expectViolation: false,
    },
    {
      name: 'passes valid scaffold with blockedBy',
      input: [
        { id: 'x', status: 'scaffold', providerPath: null, hasBlockedBy: true },
      ],
      expectViolation: false,
    },
  ];
  let pass = 0;
  let fail = 0;
  for (const f of fixtures) {
    const violations = checkRegistry(f.input);
    const got = violations.length > 0;
    if (got === f.expectViolation) {
      pass++;
    } else {
      fail++;
      console.error(
        `  ✗ ${f.name}: expected violation=${f.expectViolation}, got ${got} (${violations.join(', ')})`,
      );
    }
  }
  console.log(`self-test: ${pass}/${pass + fail} passed`);
  return fail === 0;
}

function main() {
  if (SELF_TEST) {
    process.exit(selfTest() ? 0 : 1);
  }

  if (!existsSync(REGISTRY_FILE)) {
    console.error(`verify-vendor-registry: ${REGISTRY_FILE} not found`);
    process.exit(1);
  }
  const source = readFileSync(REGISTRY_FILE, 'utf8');
  const entries = parseRegistry(source);
  if (!entries || entries.length === 0) {
    console.error('verify-vendor-registry: could not parse VENDOR_REGISTRY');
    process.exit(1);
  }
  const violations = checkRegistry(entries);
  console.log(
    `verify-vendor-registry: scanned ${entries.length} entries · ${violations.length} violation(s)`,
  );
  if (violations.length > 0) {
    for (const v of violations) console.error(`  ✗ ${v}`);
    console.error('\n✗ Registry consistency check failed.');
    process.exit(1);
  }
  console.log(
    '✓ Vendor registry consistent (providerPaths exist, statuses justified).',
  );
}

main();
