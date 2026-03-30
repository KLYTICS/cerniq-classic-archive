#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ensure_node_path() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  local candidate
  for candidate in \
    /opt/homebrew/opt/node@22/bin \
    /opt/homebrew/bin \
    /usr/local/bin
  do
    if [[ -x "$candidate/node" ]]; then
      export PATH="$candidate:$PATH"
      return 0
    fi
  done
}

print_section() {
  printf '\n== %s ==\n' "$1"
}

read_coverage_summary() {
  local app_dir="$1"
  local summary_path="$app_dir/coverage/coverage-summary.json"
  local final_path="$app_dir/coverage/coverage-final.json"

  if [[ -f "$final_path" ]]; then
    node - "$final_path" <<'NODE'
const fs = require('fs');
const finalPath = process.argv[2];
const report = JSON.parse(fs.readFileSync(finalPath, 'utf8'));

let statementCovered = 0;
let statementTotal = 0;
let functionCovered = 0;
let functionTotal = 0;
let branchCovered = 0;
let branchTotal = 0;
const coveredLines = new Set();
const allLines = new Set();

for (const entry of Object.values(report)) {
  for (const value of Object.values(entry.s || {})) {
    statementTotal += 1;
    if (value > 0) statementCovered += 1;
  }

  for (const value of Object.values(entry.f || {})) {
    functionTotal += 1;
    if (value > 0) functionCovered += 1;
  }

  for (const values of Object.values(entry.b || {})) {
    for (const value of values) {
      branchTotal += 1;
      if (value > 0) branchCovered += 1;
    }
  }

  for (const [statementId, location] of Object.entries(entry.statementMap || {})) {
    const line = location.start.line;
    allLines.add(`${entry.path}:${line}`);
    if ((entry.s || {})[statementId] > 0) {
      coveredLines.add(`${entry.path}:${line}`);
    }
  }
}

function pct(covered, total) {
  return total === 0 ? '100.00' : ((covered / total) * 100).toFixed(2);
}

console.log(
  [
    `statements=${pct(statementCovered, statementTotal)}%`,
    `branches=${pct(branchCovered, branchTotal)}%`,
    `functions=${pct(functionCovered, functionTotal)}%`,
    `lines=${pct(coveredLines.size, allLines.size)}%`,
  ].join('  '),
);
NODE
    return 0
  fi

  if [[ -f "$summary_path" ]]; then
    local summary_output
    summary_output="$(node - "$summary_path" <<'NODE'
const fs = require('fs');
const summaryPath = process.argv[2];
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total;
const metrics = [
  total?.statements?.pct,
  total?.branches?.pct,
  total?.functions?.pct,
  total?.lines?.pct,
];
const usable = metrics.every((value) => value !== 'Unknown' && value != null);
if (!usable) {
  process.exit(2);
}
process.stdout.write(
  [
    `statements=${total.statements.pct}%`,
    `branches=${total.branches.pct}%`,
    `functions=${total.functions.pct}%`,
    `lines=${total.lines.pct}%`,
  ].join('  '),
);
NODE
    )" || summary_output=""
    if [[ -n "$summary_output" ]]; then
      printf '%s\n' "$summary_output"
      return 0
    fi
  fi

  printf 'missing: %s or %s\n' "$summary_path" "$final_path"
}

cd "$ROOT_DIR"
ensure_node_path

print_section "Workspace"
printf 'cwd=%s\n' "$ROOT_DIR"
printf 'date=%s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"

print_section "Git"
git status --short --branch

print_section "Backend Coverage"
read_coverage_summary "$ROOT_DIR/backend-node"

print_section "Frontend Coverage"
read_coverage_summary "$ROOT_DIR/frontend"

print_section "Recommended Commands"
cat <<'EOF'
Backend coverage:   cd backend-node && npm run test:cov -- --runInBand
Frontend coverage:  cd frontend && npm run test:cov
Shared status:      ./scripts/first-gate-status.sh
EOF
