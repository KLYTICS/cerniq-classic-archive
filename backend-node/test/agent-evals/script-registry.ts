/**
 * Static registry of every authored LLM script + its paired golden case.
 *
 * Explicit enumeration rather than glob discovery so:
 *   (1) Adding a script is a single-file diff (this file). Reviewers can see
 *       the full agent-eval surface in one place.
 *   (2) The scorecard CLI doesn't have to invoke `require()` against an
 *       arbitrary `*.script.ts` file at runtime — every entry is statically
 *       imported and type-checked.
 *   (3) Future contributors can copy the existing rows when adding a script
 *       for a new golden.
 *
 * If a golden case has no script yet, do NOT add a row — the scorecard CLI
 * will report it as "unscripted" so the gap is visible.
 */

import type { LLMScript } from './runner/mock-llm-bridge';

import almDecision001 from './cases/alm-decision/001.script';
import almDecision002 from './cases/alm-decision/002.script';
import almDecision003 from './cases/alm-decision/003.script';
import almDecision004 from './cases/alm-decision/004.script';
import almDecision005 from './cases/alm-decision/005.script';
import almDecision006 from './cases/alm-decision/006.script';
import almDecision007 from './cases/alm-decision/007.script';
import almDecision008 from './cases/alm-decision/008.script';
import almDecision009 from './cases/alm-decision/009.script';
import almDecision010 from './cases/alm-decision/010.script';
import cfoCopilot001 from './cases/cfo-copilot/001.script';
import committeeReport001 from './cases/committee-report/001.script';
import riskMonitor001 from './cases/risk-monitor/001.script';
import riskMonitor002 from './cases/risk-monitor/002.script';

export interface ScriptRegistryEntry {
  agentDir: string;
  agentId: string; // canonical (ALM_DECISION / CFO_COPILOT / ...)
  caseFile: string;
  script: LLMScript;
}

export const SCRIPT_REGISTRY: ScriptRegistryEntry[] = [
  // ── ALM_DECISION (10 scripts, 10 goldens) ─────────────────────────────────
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '001-high-rate-risk-adequate-liquidity.json',
    script: almDecision001,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '002-liquidity-stress-capital-erosion.json',
    script: almDecision002,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '003-concentration-risk-auto-loans.json',
    script: almDecision003,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '004-cecl-inadequacy-commercial.json',
    script: almDecision004,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '005-capital-adequacy-breach.json',
    script: almDecision005,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '006-deposit-flight-scenario.json',
    script: almDecision006,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '007-earlywarning-composite-amber.json',
    script: almDecision007,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '008-balanced-healthy-benchmark.json',
    script: almDecision008,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '009-hurricane-pr-catastrophic-overlay.json',
    script: almDecision009,
  },
  {
    agentDir: 'alm-decision',
    agentId: 'ALM_DECISION',
    caseFile: '010-bilingual-pr-cooperativa.json',
    script: almDecision010,
  },
  // ── CFO_COPILOT (1 script, 1 golden) ──────────────────────────────────────
  {
    agentDir: 'cfo-copilot',
    agentId: 'CFO_COPILOT',
    caseFile: '001-rate-shock-200bps.json',
    script: cfoCopilot001,
  },
  // ── COMMITTEE_REPORT (1 script, 1 golden) ─────────────────────────────────
  {
    agentDir: 'committee-report',
    agentId: 'COMMITTEE_REPORT',
    caseFile: '001-board-bilingual.json',
    script: committeeReport001,
  },
  // ── RISK_MONITOR (2 scripts, 2 goldens) ───────────────────────────────────
  {
    agentDir: 'risk-monitor',
    agentId: 'RISK_MONITOR',
    caseFile: '001-quiet-run.json',
    script: riskMonitor001,
  },
  {
    agentDir: 'risk-monitor',
    agentId: 'RISK_MONITOR',
    caseFile: '002-critical-lcr-breach.json',
    script: riskMonitor002,
  },
];

/** Convenience: filter the registry to one agent type. */
export function scriptsForAgent(agentId: string): ScriptRegistryEntry[] {
  return SCRIPT_REGISTRY.filter((e) => e.agentId === agentId);
}

/** Convenience: list every known agentId in registry order. */
export function knownAgentIds(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of SCRIPT_REGISTRY) {
    if (!seen.has(e.agentId)) {
      seen.add(e.agentId);
      out.push(e.agentId);
    }
  }
  return out;
}
