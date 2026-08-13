#!/usr/bin/env ts-node
/**
 * CLI: PR cooperativa market enterprise quality scan.
 *
 * Scores curated COSSEC Q4-2025 snapshots and inventories the full GTM
 * universe (outbound CSV). Uncovered institutions are DATA_UNAVAILABLE (D1)
 * — never silent zeros.
 *
 * Usage:
 *   npm run market:quality-scan
 *   npm run market:quality-scan -- --json
 *   npm run market:quality-scan -- --json=/tmp/market-scan.json
 *   npm run market:quality-scan -- --html=/tmp/market-scan.html
 *   npm run market:quality-scan -- --self-test
 */
import { writeFileSync } from 'fs';
import {
  buildMarketScanReport,
  type MarketScanReport,
} from '../src/alm/market-scan/pr-market-quality.util';

function parseArgs(argv: string[]) {
  let jsonPath: string | null = null;
  let htmlPath: string | null = null;
  let selfTest = false;
  for (const arg of argv) {
    if (arg === '--self-test') selfTest = true;
    else if (arg === '--json') jsonPath = 'market-quality-scan.json';
    else if (arg.startsWith('--json=')) jsonPath = arg.slice('--json='.length);
    else if (arg === '--html') htmlPath = 'market-quality-scan.html';
    else if (arg.startsWith('--html=')) htmlPath = arg.slice('--html='.length);
  }
  return { jsonPath, htmlPath, selfTest };
}

function printSummary(report: MarketScanReport): void {
  const line = '─'.repeat(72);
  console.log(line);
  console.log('  CERNIQ — Puerto Rico cooperativa market quality scan');
  console.log(
    `  Universe ${report.universeCount} · scored ${report.scoredCount} · uncovered ${report.uncoveredCount} · coverage ${report.coveragePct}%`,
  );
  console.log(`  As of ${report.asOfQuarter} · generated ${report.generatedAt}`);
  console.log(line);
  console.log(
    `  Grades  A:${report.gradeHistogram.A}  B:${report.gradeHistogram.B}  C:${report.gradeHistogram.C}  D:${report.gradeHistogram.D}  UNAVAILABLE:${report.gradeHistogram.UNAVAILABLE}`,
  );
  console.log('');
  console.log('  Top scored (snapshot-backed):');
  for (const row of report.rows.filter((r) => r.coverage === 'snapshot_scored').slice(0, 10)) {
    console.log(
      `    ${String(row.healthScore).padStart(3)} ${row.healthGrade}  ${(row.slug || '').padEnd(14)} ${row.name}`,
    );
  }
  console.log('');
  for (const d of report.disclosures) {
    console.log(`  · ${d}`);
  }
  console.log(line);
}

function renderHtml(report: MarketScanReport): string {
  const rows = report.rows
    .map((r) => {
      const score = r.healthScore === null ? '—' : String(r.healthScore);
      const grade = r.healthGrade ?? '—';
      const gaps = r.gaps.map((g) => g.reason).join(', ') || '—';
      return `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.slug || '—')}</td><td>${r.coverage}</td><td>${score}</td><td>${grade}</td><td>${escapeHtml(gaps)}</td></tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>CerniQ PR Market Quality Scan</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:2rem;color:#111}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f4f4f5}
.meta{margin-bottom:1.5rem;color:#444}
</style></head><body>
<h1>Puerto Rico cooperativa market quality scan</h1>
<div class="meta">
<p>Universe ${report.universeCount} · scored ${report.scoredCount} · coverage ${report.coveragePct}% · ${report.asOfQuarter}</p>
<p>${report.disclosures.map(escapeHtml).join('<br/>')}</p>
</div>
<table><thead><tr><th>Institution</th><th>Slug</th><th>Coverage</th><th>Score</th><th>Grade</th><th>Gaps</th></tr></thead>
<tbody>
${rows}
</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runSelfTest(): void {
  const report = buildMarketScanReport({
    nowIso: '2026-07-12T00:00:00.000Z',
  });
  if (report.scoredCount < 13) {
    throw new Error(`self-test: expected ≥13 scored, got ${report.scoredCount}`);
  }
  // Floor is 91 — the measured size of the COSSEC cooperativa universe, not a
  // round number. The original ≥100 was aspirational and went red the moment
  // 91f67ad3 corrected the registry down to the real 91-coop COSSEC list; the
  // threshold was never re-baselined, so verify:local:e2e has been failing
  // since. D24: floors track measurement and only ratchet UP from here — if
  // COSSEC publishes more cooperativas, raise this to the new count.
  if (report.universeCount < 91) {
    throw new Error(
      `self-test: expected universe ≥91, got ${report.universeCount}`,
    );
  }
  if (report.uncoveredCount < 1) {
    throw new Error('self-test: expected uncovered institutions (D1 coverage gap)');
  }
  const silentZero = report.rows.find(
    (r) => r.coverage === 'universe_only' && r.healthScore === 0,
  );
  if (silentZero) {
    throw new Error('self-test: D1 violation — silent zero on uncovered row');
  }
  console.log(
    `self-test PASS — scored=${report.scoredCount} universe=${report.universeCount} uncovered=${report.uncoveredCount}`,
  );
}

async function main(): Promise<void> {
  const { jsonPath, htmlPath, selfTest } = parseArgs(process.argv.slice(2));
  if (selfTest) {
    runSelfTest();
    return;
  }

  const report = buildMarketScanReport();
  printSummary(report);

  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`Wrote JSON → ${jsonPath}`);
  }
  if (htmlPath) {
    writeFileSync(htmlPath, renderHtml(report));
    console.log(`Wrote HTML → ${htmlPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
