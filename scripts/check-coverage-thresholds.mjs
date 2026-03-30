#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(
    'Usage: node scripts/check-coverage-thresholds.mjs <coveragePath> <label> <statements> <branches> <functions> <lines>',
  );
}

const [coveragePathArg, label = 'coverage', statementsArg, branchesArg, functionsArg, linesArg] =
  process.argv.slice(2);

if (
  !coveragePathArg ||
  statementsArg == null ||
  branchesArg == null ||
  functionsArg == null ||
  linesArg == null
) {
  usage();
  process.exit(1);
}

function pct(covered, total) {
  if (total === 0) {
    return 100;
  }
  return Number(((covered / total) * 100).toFixed(2));
}

function metricsFromSummary(summaryPath) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const total = summary.total;

  if (!total) {
    throw new Error(`Missing total coverage block in ${summaryPath}`);
  }

  const actual = {
    statements: Number(total.statements?.pct),
    branches: Number(total.branches?.pct),
    functions: Number(total.functions?.pct),
    lines: Number(total.lines?.pct),
  };

  const invalidMetric = Object.entries(actual).find(
    ([, value]) => !Number.isFinite(value),
  );

  if (invalidMetric) {
    throw new Error(
      `Invalid ${invalidMetric[0]} coverage value in ${summaryPath}: ${invalidMetric[1]}`,
    );
  }

  return actual;
}

function metricsFromFinal(finalPath) {
  const report = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
  let statementCovered = 0;
  let statementTotal = 0;
  let functionCovered = 0;
  let functionTotal = 0;
  let branchCovered = 0;
  let branchTotal = 0;
  let coveredLines = 0;
  let lineTotal = 0;

  for (const entry of Object.values(report)) {
    const statementHits = Object.values(entry.s || {});
    statementTotal += statementHits.length;
    statementCovered += statementHits.filter((value) => value > 0).length;

    const functionHits = Object.values(entry.f || {});
    functionTotal += functionHits.length;
    functionCovered += functionHits.filter((value) => value > 0).length;

    const branchHits = Object.values(entry.b || {}).flat();
    branchTotal += branchHits.length;
    branchCovered += branchHits.filter((value) => value > 0).length;

    const lineHits = new Map();
    for (const [statementId, location] of Object.entries(entry.statementMap || {})) {
      const line = location?.start?.line;
      if (!Number.isFinite(line)) {
        continue;
      }
      const current = lineHits.get(line) || 0;
      lineHits.set(line, Math.max(current, entry.s?.[statementId] || 0));
    }
    lineTotal += lineHits.size;
    coveredLines += Array.from(lineHits.values()).filter((value) => value > 0).length;
  }

  return {
    statements: pct(statementCovered, statementTotal),
    branches: pct(branchCovered, branchTotal),
    functions: pct(functionCovered, functionTotal),
    lines: pct(coveredLines, lineTotal),
  };
}

function resolveCoverageCandidates(coveragePath) {
  const resolved = path.resolve(coveragePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Coverage path not found: ${resolved}`);
  }

  if (fs.statSync(resolved).isDirectory()) {
    return [
      { kind: 'final', path: path.join(resolved, 'coverage-final.json') },
      { kind: 'summary', path: path.join(resolved, 'coverage-summary.json') },
    ];
  }

  if (resolved.endsWith('coverage-summary.json')) {
    return [
      { kind: 'final', path: path.join(path.dirname(resolved), 'coverage-final.json') },
      { kind: 'summary', path: resolved },
    ];
  }

  if (resolved.endsWith('coverage-final.json')) {
    return [{ kind: 'final', path: resolved }];
  }

  return [
    { kind: 'summary', path: resolved },
    { kind: 'final', path: resolved },
  ];
}

function loadCoverageMetrics(coveragePath) {
  const candidates = resolveCoverageCandidates(coveragePath);
  const errors = [];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.path)) {
      continue;
    }

    try {
      if (candidate.kind === 'summary') {
        return {
          source: candidate.path,
          actual: metricsFromSummary(candidate.path),
        };
      }

      return {
        source: candidate.path,
        actual: metricsFromFinal(candidate.path),
      };
    } catch (error) {
      errors.push(`${candidate.path}: ${error.message}`);
    }
  }

  throw new Error(
    errors.length > 0
      ? errors.join('\n')
      : `No usable coverage artifacts found for ${coveragePath}`,
  );
}

const thresholds = {
  statements: Number.parseFloat(statementsArg),
  branches: Number.parseFloat(branchesArg),
  functions: Number.parseFloat(functionsArg),
  lines: Number.parseFloat(linesArg),
};

const { source, actual } = loadCoverageMetrics(coveragePathArg);

const reportLines = [
  `Coverage gate for ${label} (${source})`,
  `- statements: ${actual.statements.toFixed(2)}% (min ${thresholds.statements.toFixed(2)}%)`,
  `- branches: ${actual.branches.toFixed(2)}% (min ${thresholds.branches.toFixed(2)}%)`,
  `- functions: ${actual.functions.toFixed(2)}% (min ${thresholds.functions.toFixed(2)}%)`,
  `- lines: ${actual.lines.toFixed(2)}% (min ${thresholds.lines.toFixed(2)}%)`,
];

console.log(reportLines.join('\n'));

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `### ${label} coverage`,
      '',
      `Source: \`${source}\``,
      '',
      `- statements: ${actual.statements.toFixed(2)}% (min ${thresholds.statements.toFixed(2)}%)`,
      `- branches: ${actual.branches.toFixed(2)}% (min ${thresholds.branches.toFixed(2)}%)`,
      `- functions: ${actual.functions.toFixed(2)}% (min ${thresholds.functions.toFixed(2)}%)`,
      `- lines: ${actual.lines.toFixed(2)}% (min ${thresholds.lines.toFixed(2)}%)`,
      '',
    ].join('\n'),
  );
}

const failures = Object.entries(thresholds).filter(
  ([metric, threshold]) => actual[metric] < threshold,
);

if (failures.length > 0) {
  console.error(
    `Coverage gate failed for ${label}: ${failures
      .map(([metric]) => metric)
      .join(', ')}`,
  );
  process.exit(1);
}
