#!/usr/bin/env node
/**
 * verify-userid-chain.mjs — CI guard locking the canonical req.user
 * identity-extraction chain across CerniQ's NestJS controllers.
 *
 * Background:
 *   `AuthGuard` canonically sets `req.user.userId` (auth.guard.ts:271).
 *   Legacy JWT-strategy code paths also surface `req.user.id` (from JWT
 *   `iat`/payload) and `req.user.sub` (JWT subject). When a controller
 *   reads `req.user?.id` directly (skipping `userId`), it picks up
 *   whatever field happens to be in the auth payload — NOT the canonical
 *   user identity. Audit logs misattribute work, IDOR helpers compare the
 *   wrong key, and the bug is invisible unless you read every controller.
 *
 *   IDOR_RESIDUAL_AUDIT.md flagged this as a follow-up sweep. R5 turns it
 *   into a structural ratchet: the canonical chain is locked at the
 *   verifier layer, future regressions fail `npm run lint`.
 *
 * Rule (R5):
 *   For every line in every `*.controller.ts` under `src/` that reads
 *   `req.user?.id` or `req.user?.sub`, the same line MUST also contain
 *   `req.user?.userId`, AND `req.user?.userId` MUST appear textually
 *   BEFORE the first `id`/`sub` access (so the `??` chain falls through
 *   in canonical order).
 *
 *   Escape hatch:
 *     // verify:userid-chain-skip — <non-empty reason>
 *   On the same line, OR on the immediately-preceding line. Empty reason
 *   does not exempt — same convention as R2/R3.
 *
 * Why same-line and not whole-expression:
 *   In current code the chain is always written as one line
 *   (`userId ?? id ?? sub`). If a future change formats it multi-line,
 *   that's a 3-line window extension on this verifier — same fix shape
 *   as we did for R3 v2's skip-lookback.
 *
 * Flags:
 *   (none)        scan + report; non-strict mode exits 0 even on violations
 *   --quiet       suppress per-violation detail; final summary only
 *   --strict      exit 1 if any violations found (wired into npm run lint)
 *   --self-test   exercise the rule against in-memory fixture cases
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_ROOT = join(ROOT, 'src');

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const STRICT = argv.includes('--strict');
const SELF_TEST = argv.includes('--self-test');

const CONTROLLER_FILE_RE = /\.controller\.ts$/;

// Patterns. Optional chaining `req.user?.id` is the dominant form; bare
// `req.user.id` is rare in this codebase but caught for completeness.
const REQ_USER_ID_RE = /\breq\.user\??\.(id|sub)\b/g;
const REQ_USER_USERID_RE = /\breq\.user\??\.userId\b/g;

const SKIP_RE = /\/\/\s*verify:userid-chain-skip(?:\s*[—\-:]\s*(.+?))?\s*$/;

/**
 * Inspect a controller source text and return per-line violations.
 *
 * Returns `{ violations: [{ line, lineText, problem }] }`.
 *
 * A violation is any line that:
 *   - contains a `req.user?.id` or `req.user?.sub` access, AND
 *   - does not have a same-line or previous-line `// verify:userid-chain-skip — <reason>`,
 *     AND
 *   - either does NOT also contain `req.user?.userId` on the same line,
 *     OR does contain it but the first `userId` position is AFTER the
 *     first `id`/`sub` position (wrong chain order).
 */
export function scanController(text) {
  const lines = text.split('\n');
  const violations = [];

  // Pre-collect skip-annotated line indices (1-based to match emitted output).
  // A skip applies to its own line AND to the next non-comment line.
  const skipReasonAtLine = new Map(); // 1-based line -> reason
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SKIP_RE);
    if (m && m[1] && m[1].trim().length > 0) {
      skipReasonAtLine.set(i + 1, m[1].trim());
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip line-trailing `//` comments to avoid matching the literal
    // pattern inside a comment. Preserve the comment for skip detection.
    const codePart = stripTrailingLineComment(line);

    REQ_USER_ID_RE.lastIndex = 0;
    const idMatches = [];
    let m;
    while ((m = REQ_USER_ID_RE.exec(codePart)) !== null) {
      idMatches.push({ index: m.index, field: m[1] });
    }
    if (idMatches.length === 0) continue;

    // Same-line or previous-line skip?
    const lineNo1 = i + 1;
    if (skipReasonAtLine.has(lineNo1) || skipReasonAtLine.has(lineNo1 - 1)) {
      continue;
    }

    REQ_USER_USERID_RE.lastIndex = 0;
    const userIdMatches = [];
    while ((m = REQ_USER_USERID_RE.exec(codePart)) !== null) {
      userIdMatches.push(m.index);
    }

    const firstIdIdx = idMatches[0].index;
    if (userIdMatches.length === 0) {
      violations.push({
        line: lineNo1,
        lineText: line.trimEnd(),
        problem: `reads req.user?.${idMatches[0].field} without canonical req.user?.userId on the same line`,
      });
      continue;
    }
    const firstUserIdIdx = userIdMatches[0];
    if (firstUserIdIdx > firstIdIdx) {
      violations.push({
        line: lineNo1,
        lineText: line.trimEnd(),
        problem: `req.user?.userId appears AFTER req.user?.${idMatches[0].field} — wrong chain order (canonical: userId ?? id ?? sub)`,
      });
    }
  }

  return { violations };
}

/**
 * Strip the trailing `//`-style line comment from a line.
 * Does NOT attempt to be JS-aware (no string-literal tracking) because
 * the patterns we match cannot legally appear inside a string literal as
 * a "real" access — and even if they did, false-flagging a string-literal
 * `'req.user?.id'` is acceptable (treat the comment as if commented out
 * code would have been written canonically anyway).
 */
function stripTrailingLineComment(line) {
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function walkControllers(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist') continue;
        stack.push(full);
      } else if (ent.isFile() && CONTROLLER_FILE_RE.test(ent.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function runLive() {
  const files = walkControllers(SRC_ROOT);
  const allViolations = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const { violations } = scanController(text);
    for (const v of violations) {
      allViolations.push({ file: relative(ROOT, file), ...v });
    }
  }

  console.log(
    `verify-userid-chain: ${files.length} controller(s) scanned, ${allViolations.length} violation(s).`,
  );

  if (allViolations.length > 0 && !QUIET) {
    for (const v of allViolations) {
      console.log(`  ${v.file}:${v.line} — ${v.problem}`);
      console.log(`    ${v.lineText}`);
    }
  }

  if (STRICT && allViolations.length > 0) process.exit(1);
  process.exit(0);
}

// ────────────────────────────────────────────────────────────────────────────
// Self-test
// ────────────────────────────────────────────────────────────────────────────

const SELF_TEST_CASES = [
  {
    name: 'canonical 3-field chain — OK',
    text: `
async ask(@Req() req: any) {
  const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
  return userId;
}
`,
    expectViolations: 0,
  },
  {
    name: 'canonical chain with sentinel — OK',
    text: `
async ask(@Req() req: any) {
  const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'anonymous';
  return userId;
}
`,
    expectViolations: 0,
  },
  {
    name: 'id-only with system sentinel — VIOLATION (audit-actor pattern)',
    text: `
async signOff(@Req() req: any) {
  const userId = req.user?.id ?? 'system';
  return userId;
}
`,
    expectViolations: 1,
  },
  {
    name: 'id-or-sub without userId — VIOLATION',
    text: `
async deleteSession(@Req() req: any) {
  return req.user?.id ?? req.user?.sub ?? '';
}
`,
    expectViolations: 1,
  },
  {
    name: 'id bare in property assignment — VIOLATION',
    text: `
const dto = { userId: req.user?.id, foo: 1 };
`,
    expectViolations: 1,
  },
  {
    name: 'wrong chain order (id before userId) — VIOLATION',
    text: `
const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
`,
    expectViolations: 1,
  },
  {
    name: 'just userId, no id/sub — OK (rule does not fire)',
    text: `
const userId = req.user?.userId;
`,
    expectViolations: 0,
  },
  {
    name: 'skip annotation inline with reason — OK',
    text: `
const userId = req.user?.id ?? 'system'; // verify:userid-chain-skip — close cockpit AuthedRequest typed pre-Auth0 migration
`,
    expectViolations: 0,
  },
  {
    name: 'skip annotation above with reason — OK',
    text: `
// verify:userid-chain-skip — JWT pre-resolution callback, userId not yet bound
const userId = req.user?.id ?? req.user?.sub;
`,
    expectViolations: 0,
  },
  {
    name: 'skip annotation with EMPTY reason — VIOLATION (reason required)',
    text: `
const userId = req.user?.id; // verify:userid-chain-skip
`,
    expectViolations: 1,
  },
  {
    name: 'skip annotation with reason text — OK',
    text: `
const userId = req.user?.id; // verify:userid-chain-skip — reason here
`,
    expectViolations: 0,
  },
  {
    name: 'literal pattern in a single-line comment — OK (not real access)',
    text: `
// reads from req.user?.id as the audit-actor field
const userId = req.user?.userId;
`,
    expectViolations: 0,
  },
  {
    name: 'two violations on same line — counted once per match line (line-level)',
    text: `
const x = req.user?.id; const y = req.user?.sub;
`,
    // Both occurrences are on ONE line, and the rule fires once per
    // line at the first match. Documents the line-level cardinality.
    expectViolations: 1,
  },
  {
    name: 'two violations on adjacent lines — both counted',
    text: `
const a = req.user?.id ?? 'x';
const b = req.user?.sub ?? 'y';
`,
    expectViolations: 2,
  },
  {
    name: 'bare req.user.id without optional chain — VIOLATION',
    text: `
function actor(req: AuthedRequest) { return req.user.id; }
`,
    expectViolations: 1,
  },
  {
    name: 'sub alone — VIOLATION (canonical chain must lead with userId)',
    text: `
const userId = req.user?.sub;
`,
    expectViolations: 1,
  },
];

function runSelfTest() {
  let pass = 0;
  let fail = 0;
  for (const c of SELF_TEST_CASES) {
    const { violations } = scanController(c.text);
    const got = violations.length;
    if (got === c.expectViolations) {
      pass++;
      console.log(`  ✓ ${c.name}`);
    } else {
      fail++;
      console.log(
        `  ✗ ${c.name} — expected ${c.expectViolations} violations, got ${got}`,
      );
      for (const v of violations) {
        console.log(`      line ${v.line}: ${v.problem}`);
        console.log(`      ${v.lineText}`);
      }
    }
  }
  console.log(
    `verify-userid-chain self-test: ${pass}/${pass + fail} case(s) pass.`,
  );
  process.exit(fail === 0 ? 0 : 1);
}

if (SELF_TEST) {
  runSelfTest();
} else {
  runLive();
}
