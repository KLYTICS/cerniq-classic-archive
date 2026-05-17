#!/usr/bin/env node
// scripts/audit-klytics.mjs
//
// KLYTICS Audit Discipline matrix runner — single-command view of all 12
// rules' current state on CerniQ. Aggregates the existing
// verify:rule-{4,9,11,12} (and supporting verify:tenant-scope,
// verify:auth-coverage, etc.) into one report.
//
// See docs/platform/KLYTICS_AUDIT_DISCIPLINE.md for normative rule text
// and the cross-product maturity matrix. This script implements the
// "let me see the current per-rule state for THIS product" path so a
// reviewer doesn't have to invoke 9 different verify:rule-* commands by
// hand.
//
// Usage:
//   node scripts/audit-klytics.mjs            full report
//   node scripts/audit-klytics.mjs --summary  one-line score only
//   node scripts/audit-klytics.mjs --self-test embedded fixtures
//
// Exit codes:
//   0 — all auto-verifiable rules PASS
//   1 — at least one auto-verifiable rule FAILED
//   2 — environment misconfigured (cwd wrong, node version, etc.)
//
// Status legend (matches the canon doc §3):
//   ✅ PASS   — auto-verifier exited 0
//   ❌ FAIL   — auto-verifier exited non-zero (new offender or stale baseline)
//   🟡 PART   — partial adoption per canon (manual classification; verifier may still PASS as non-regression lock)
//   —  MANUAL — no auto-verifier; canon doc is authoritative for this rule's state
//
// Self-test (CLAUDE.md D24 ratchet point 4):
//   The aggregator's own machinery — config table parsing, exit-code
//   aggregation, status-symbol mapping — is verified by embedded
//   fixtures via --self-test. No working-tree side effects.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CANON_DOC = resolve(REPO_ROOT, 'docs/platform/KLYTICS_AUDIT_DISCIPLINE.md');

// Per-rule configuration. The canon doc owns the *normative* status (✅ / 🟡
// / ❌); this table owns the *automation* binding. When a rule has no
// auto-verifier, mode='manual' — the canon doc is authoritative.
//
// To add a verifier: bump mode to 'auto' and point at the script.
const RULES = [
  { n: 1,  name: 'No silent zeros',                       mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 2,  name: 'Gap manifests on artifacts',            mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 3,  name: 'Immutable artifacts + SHA-256 + lineage', mode: 'manual', canonStatus: '✅', cwd: null,          cmd: null },
  { n: 4,  name: 'Append-only audit trail',               mode: 'auto',   canonStatus: '✅', cwd: 'backend-node', cmd: ['node', 'scripts/verify-rule-4-audit-immutable.mjs'] },
  { n: 5,  name: 'Canonical JSON for signing',            mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 6,  name: 'Tenant isolation (app + DB)',           mode: 'auto',   canonStatus: '✅', cwd: 'backend-node', cmd: ['node', 'scripts/verify-institution-scope-guard.mjs'] },
  { n: 7,  name: 'Lineage in regulator-bound outputs',    mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 8,  name: 'Golden tests with drift detection',     mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 9,  name: 'Cost + prompt provenance',              mode: 'auto',   canonStatus: '🟡', cwd: 'backend-node', cmd: ['node', 'scripts/verify-rule-9-stamping.mjs'] },
  { n: 10, name: 'Append-only migrations',                mode: 'manual', canonStatus: '✅', cwd: null,            cmd: null },
  { n: 11, name: 'No `any` without rationale',            mode: 'auto',   canonStatus: '🟡', cwd: 'backend-node', cmd: ['node', 'scripts/verify-rule-11-any-rationale.mjs'] },
  { n: 12, name: 'Crypto randomness in security paths',   mode: 'auto',   canonStatus: '✅', cwd: 'backend-node', cmd: ['node', 'scripts/verify-rule-12-crypto-randomness.mjs'] },
];

// Status → display symbols. Kept as a function (not a literal) so the
// self-test can verify the mapping logic, not just memorize a table.
function symbolFor({ mode, exitCode, canonStatus }) {
  if (mode === 'manual') return { sym: '—', label: 'MANUAL', detail: `canon: ${canonStatus}` };
  if (exitCode === 0)    return { sym: canonStatus === '🟡' ? '🟡' : '✅', label: canonStatus === '🟡' ? 'PART' : 'PASS', detail: 'verifier exited 0' };
  return { sym: '❌', label: 'FAIL', detail: `verifier exited ${exitCode}` };
}

function color(s, code) {
  return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const green  = (s) => color(s, '32');
const red    = (s) => color(s, '31');
const yellow = (s) => color(s, '33');
const gray   = (s) => color(s, '90');

// Parses the canon doc's §3 matrix table to extract the CerniQ column's
// per-rule status, plus the "CerniQ: X/Y" score line. Returns {} on parse
// failure so the aggregator stays usable if the canon doc moves. Drift
// vs hardcoded RULES.canonStatus is reported as a warning, not a fail —
// the aggregator's job is to report state, not enforce canon correctness.
function parseCanon(docPath = CANON_DOC) {
  const out = { rules: {}, score: null, error: null };
  if (!existsSync(docPath)) {
    out.error = `canon doc not found at ${docPath}`;
    return out;
  }
  const text = readFileSync(docPath, 'utf8');
  const lines = text.split('\n');

  // Find the matrix header row. The canon header looks like:
  //   | Rule | ComplyKit | AEGIS | CerniQ | Apex |
  const headerIdx = lines.findIndex((l) => /^\|\s*Rule\s*\|/.test(l) && /CerniQ/.test(l));
  if (headerIdx < 0) {
    out.error = 'matrix header (| Rule | … | CerniQ | …) not found';
  } else {
    const headerCells = lines[headerIdx].split('|').map((c) => c.trim());
    // headerCells has a leading empty cell from the leading `|`; find CerniQ's position.
    const cerniqIdx = headerCells.findIndex((c) => c === 'CerniQ');
    // Skip header (headerIdx) + separator (headerIdx+1); parse rows until blank or no leading `|`.
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('|')) break;
      const cells = line.split('|').map((c) => c.trim());
      const m = /^(\d+)\.\s/.exec(cells[1] || '');
      if (!m) continue;
      const n = parseInt(m[1], 10);
      const status = (cells[cerniqIdx] || '').trim();
      if (n >= 1 && n <= 12 && status) out.rules[n] = status;
    }
  }

  // Parse the "- **CerniQ**: X/Y" score line.
  const m = /^- \*\*CerniQ\*\*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/m.exec(text);
  if (m) out.score = { earned: parseFloat(m[1]), total: parseInt(m[2], 10) };

  return out;
}

function runVerifier(rule) {
  if (rule.mode === 'manual') return { exitCode: null, stderr: '', durationMs: 0 };
  const cwd = resolve(REPO_ROOT, rule.cwd);
  if (!existsSync(cwd)) return { exitCode: 2, stderr: `cwd ${cwd} missing`, durationMs: 0 };
  const start = Date.now();
  const r = spawnSync(rule.cmd[0], rule.cmd.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { exitCode: r.status ?? 2, stderr: r.stderr || '', durationMs: Date.now() - start };
}

function scoreOf(results) {
  // Mirrors the canon doc §3 formula: ✅=1, 🟡=0.5, —=full credit (n/a treated as PASS), ❌=0.
  let earned = 0;
  let total  = 0;
  for (const r of results) {
    total += 1;
    if (r.symLabel === 'PASS')   earned += 1;
    else if (r.symLabel === 'PART') earned += 0.5;
    else if (r.symLabel === 'MANUAL' && r.rule.canonStatus === '✅') earned += 1;
    else if (r.symLabel === 'MANUAL' && r.rule.canonStatus === '🟡') earned += 0.5;
    else if (r.symLabel === 'MANUAL' && r.rule.canonStatus === '❌') earned += 0;
    // FAIL contributes 0.
  }
  return { earned, total };
}

function renderRow(r, opts = {}) {
  const num = `Rule ${String(r.rule.n).padStart(2)}`;
  const name = r.rule.name.padEnd(46);
  const colored = r.symLabel === 'PASS' ? green(`${r.sym} ${r.symLabel}`)
                : r.symLabel === 'PART' ? yellow(`${r.sym} ${r.symLabel}`)
                : r.symLabel === 'FAIL' ? red(`${r.sym} ${r.symLabel}`)
                :                         gray(`${r.sym} ${r.symLabel}`);
  const detail = opts.verbose ? gray(`  ${r.detail}`) : '';
  const timing = opts.verbose && r.durationMs ? gray(` ${r.durationMs}ms`) : '';
  return `  ${num}  ${name}  ${colored}${detail}${timing}`;
}

function selfTest() {
  console.log('\naudit-klytics --self-test');
  console.log('============================================');
  let fails = 0;
  const assert = (label, expected, actual) => {
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
      console.log(`  ${green('PASS')}  ${label}`);
    } else {
      console.log(`  ${red('FAIL')}  ${label}  expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`);
      fails += 1;
    }
  };

  // 1. symbolFor — manual mode preserves canon status as detail.
  let s = symbolFor({ mode: 'manual', exitCode: null, canonStatus: '✅' });
  assert('symbolFor(manual, ✅) → — MANUAL', { sym: '—', label: 'MANUAL' }, { sym: s.sym, label: s.label });

  // 2. symbolFor — auto + exit 0 + ✅ canon → PASS green
  s = symbolFor({ mode: 'auto', exitCode: 0, canonStatus: '✅' });
  assert('symbolFor(auto, exit 0, ✅) → ✅ PASS', { sym: '✅', label: 'PASS' }, { sym: s.sym, label: s.label });

  // 3. symbolFor — auto + exit 0 + 🟡 canon → PART yellow (verifier passes as non-regression lock; canon still says partial)
  s = symbolFor({ mode: 'auto', exitCode: 0, canonStatus: '🟡' });
  assert('symbolFor(auto, exit 0, 🟡) → 🟡 PART', { sym: '🟡', label: 'PART' }, { sym: s.sym, label: s.label });

  // 4. symbolFor — auto + exit 1 → FAIL regardless of canon
  s = symbolFor({ mode: 'auto', exitCode: 1, canonStatus: '✅' });
  assert('symbolFor(auto, exit 1, ✅) → ❌ FAIL', { sym: '❌', label: 'FAIL' }, { sym: s.sym, label: s.label });
  s = symbolFor({ mode: 'auto', exitCode: 1, canonStatus: '🟡' });
  assert('symbolFor(auto, exit 1, 🟡) → ❌ FAIL', { sym: '❌', label: 'FAIL' }, { sym: s.sym, label: s.label });

  // 5. scoreOf — mixed results match canon doc §3 formula.
  const fake = [
    { symLabel: 'PASS',   rule: { canonStatus: '✅' } },          // +1
    { symLabel: 'PASS',   rule: { canonStatus: '✅' } },          // +1
    { symLabel: 'PART',   rule: { canonStatus: '🟡' } },          // +0.5
    { symLabel: 'MANUAL', rule: { canonStatus: '✅' } },          // +1
    { symLabel: 'MANUAL', rule: { canonStatus: '🟡' } },          // +0.5
    { symLabel: 'FAIL',   rule: { canonStatus: '✅' } },          // +0
  ];
  assert('scoreOf(2 PASS + 1 PART + 1 MANUAL✅ + 1 MANUAL🟡 + 1 FAIL) = 4.0/6',
    { earned: 4, total: 6 },
    scoreOf(fake));

  // 6. parseCanon — exercises the canon-doc reader against the actual doc on disk.
  //    Self-test is a smoke-of-the-parser: ensures it locates the matrix + score
  //    line in the current canon doc. Doesn't assert specific values (those
  //    drift with rule adoption), but does assert non-empty results.
  if (existsSync(CANON_DOC)) {
    const c = parseCanon();
    assert('parseCanon finds matrix rows for all 12 rules', true, Object.keys(c.rules).length === 12);
    assert('parseCanon extracts a CerniQ score', true, c.score !== null && typeof c.score.earned === 'number' && typeof c.score.total === 'number');
    assert('parseCanon CerniQ Rule 12 status is ✅', '✅', c.rules[12]);
  } else {
    assert('parseCanon (skipped — canon doc not present)', true, true);
  }

  // 7. RULES table integrity — every entry has required keys + n is 1-12 unique.
  const ns = new Set();
  for (const r of RULES) {
    assert(`Rule ${r.n} has name`,      true, typeof r.name === 'string' && r.name.length > 0);
    assert(`Rule ${r.n} mode valid`,    true, r.mode === 'auto' || r.mode === 'manual');
    assert(`Rule ${r.n} canon valid`,   true, ['✅', '🟡', '❌', '—'].includes(r.canonStatus));
    if (r.mode === 'auto') {
      assert(`Rule ${r.n} has cmd`,     true, Array.isArray(r.cmd) && r.cmd.length >= 2);
      assert(`Rule ${r.n} has cwd`,     true, typeof r.cwd === 'string');
    }
    ns.add(r.n);
  }
  assert('RULES covers 1-12 unique', true, ns.size === 12 && [...ns].every((n, i) => n === i + 1));

  console.log('--------------------------------------------');
  if (fails === 0) console.log(`  ${green('self-test: PASS')} (machinery verified)`);
  else             console.log(`  ${red(`self-test: FAIL`)} (${fails} assertion(s) failed)`);
  process.exit(fails === 0 ? 0 : 1);
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--self-test')) return selfTest();
  const summaryOnly = args.has('--summary');
  const verbose = !summaryOnly;

  if (!summaryOnly) {
    console.log('');
    console.log('============================================');
    console.log('  KLYTICS Audit Discipline — CerniQ state');
    console.log('============================================');
    console.log(gray(`  Canon: docs/platform/KLYTICS_AUDIT_DISCIPLINE.md`));
    console.log(gray(`  Time:  ${new Date().toISOString()}`));
    console.log('--------------------------------------------');
  }

  const results = [];
  let anyAutoFail = false;
  for (const rule of RULES) {
    const { exitCode, durationMs } = runVerifier(rule);
    const { sym, label, detail } = symbolFor({ mode: rule.mode, exitCode, canonStatus: rule.canonStatus });
    const r = { rule, exitCode, durationMs, sym, symLabel: label, detail };
    results.push(r);
    if (label === 'FAIL') anyAutoFail = true;
    if (!summaryOnly) console.log(renderRow(r, { verbose }));
  }

  const { earned, total } = scoreOf(results);
  const scoreStr = `${Number.isInteger(earned) ? earned : earned.toFixed(1)} / ${total}`;
  const autoCount   = results.filter((r) => r.rule.mode === 'auto').length;
  const manualCount = results.filter((r) => r.rule.mode === 'manual').length;

  // Canon-doc reconciliation. The aggregator's hardcoded RULES.canonStatus
  // can drift from the canon doc over time; the canon doc's displayed
  // score can drift from its own stated formula (the 2026-05-17 audit
  // found a 10/11 vs 11/12 discrepancy for CerniQ — same shape applies
  // to Apex). Reporting both numbers and any drift forces reconciliation
  // at every review instead of letting either source silently age.
  const canon = parseCanon();
  const canonDrifts = [];
  for (const rule of RULES) {
    const parsed = canon.rules[rule.n];
    if (parsed && parsed !== rule.canonStatus) {
      canonDrifts.push({ n: rule.n, hardcoded: rule.canonStatus, doc: parsed });
    }
  }
  const canonScoreStr = canon.score
    ? `${Number.isInteger(canon.score.earned) ? canon.score.earned : canon.score.earned.toFixed(1)} / ${canon.score.total}`
    : null;
  const scoreDrift = canonScoreStr && canonScoreStr !== scoreStr;

  if (!summaryOnly) {
    console.log('--------------------------------------------');
    console.log(`  Auto-verified: ${autoCount}   Manual (canon-owned): ${manualCount}`);
    console.log(`  Score: ${scoreStr}  ${anyAutoFail ? red('— FAIL') : green('— PASS')}   (per stated formula in canon §3)`);
    if (canonScoreStr) {
      console.log(`  Canon doc displays: ${canonScoreStr}${scoreDrift ? yellow('  ⚠ drift from stated formula') : gray('  (matches)')}`);
    } else if (canon.error) {
      console.log(`  Canon doc score: ${gray('not parsed — ' + canon.error)}`);
    }
    if (canonDrifts.length > 0) {
      console.log(`  ${yellow('⚠ Canon-status drift detected:')}`);
      for (const d of canonDrifts) {
        console.log(`      Rule ${d.n}: aggregator says ${d.hardcoded}, canon doc says ${d.doc}`);
      }
      console.log(gray('      Reconcile in RULES table (scripts/audit-klytics.mjs) OR update canon doc.'));
    }
    console.log('--------------------------------------------');
    if (anyAutoFail) {
      console.log(`  ${red('AUDIT GATE: NOT READY')} — fix auto-verifier failures.`);
    } else {
      console.log(`  ${green('AUDIT GATE: READY')} — all auto-verifiers green; manual rules per canon.`);
    }
    console.log('');
  } else {
    const drift = scoreDrift ? ` (canon doc displays ${canonScoreStr} — drift)` : '';
    console.log(`KLYTICS audit: ${scoreStr} ${anyAutoFail ? 'FAIL' : 'PASS'}${drift}`);
  }

  process.exit(anyAutoFail ? 1 : 0);
}

main();
