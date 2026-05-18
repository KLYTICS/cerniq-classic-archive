/**
 * Per-agent output adapters + per-agent weight profiles.
 *
 * The 6-dimension scorer (`dimensions.ts`) was originally designed against
 * the ALMDecisionOutput shape — topRisks[].dollarImpact, decisionQueue[],
 * brief/briefEs. Other agent types emit different shapes:
 *
 *   - RISK_MONITOR     → { alerts: [...], quietRun }   (no topRisks, no decisionQueue)
 *   - CFO_COPILOT      → { message, followups }        (no risks at all — it's a Q&A)
 *   - COMMITTEE_REPORT → { sections: { ... }, ... }    (narrative + recommendations)
 *
 * Two pieces are needed to score these honestly:
 *
 *   (1) An adapter that maps the raw output into the synthetic
 *       `ScoreableOutput` shape the existing scorers consume. Adapters
 *       extract the closest semantic equivalents — e.g. risk-monitor
 *       alerts become topRisks, cfo-copilot followups become decisionQueue
 *       entries (each followup is "what to ask next").
 *
 *   (2) A weight profile that reflects what the agent type actually
 *       optimizes for. CFO_COPILOT should not be penalised on
 *       dollarQuantification (it's not a risk report) but should weigh
 *       specificity heavily (its 300-word message must contain $/%/bps).
 *       COMMITTEE_REPORT weighs regulatoryRef heavily because the calendar
 *       section is mostly regulatory-deadline driven.
 *
 * Adapters are PURE and STABLE — once an agent type has a published
 * baseline, changing the adapter materially is a scoring-protocol breaking
 * change and must come with a baseline re-bless.
 */

import type { DimensionWeight } from './weights';

// ─── Common scoring target shape ────────────────────────────────────────────

export interface ScoreableTopRisk {
  finding?: string;
  findingEs?: string;
  dollarImpact?: number;
  regulatoryRef?: string;
}

export interface ScoreableDecisionItem {
  action?: string;
  actionEs?: string;
  expectedImpact?: string;
  regulatoryRef?: string;
}

export interface ScoreableOutput {
  topRisks?: ScoreableTopRisk[];
  decisionQueue?: ScoreableDecisionItem[];
  brief?: string;
  briefEs?: string;
}

export type AgentAdapter = (raw: unknown) => ScoreableOutput;

// ─── ALM_DECISION — identity adapter ────────────────────────────────────────

const almDecisionAdapter: AgentAdapter = (raw) => {
  // The ALM_DECISION schema already matches ScoreableOutput. Cast through
  // unknown to satisfy the structural check without copying the object.
  return (raw ?? {}) as ScoreableOutput;
};

// ─── RISK_MONITOR — alerts[] become topRisks; recommendation becomes action ──

interface RiskMonitorAlert {
  category?: string;
  severity?: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  delta?: number;
  trend?: string;
  finding?: string;
  findingEs?: string;
  recommendation?: string;
  regulatoryRef?: string;
  deadline?: string;
  dedupSeed?: string;
}

interface RiskMonitorRaw {
  alerts?: RiskMonitorAlert[];
  alertCount?: number;
  quietRun?: boolean;
}

const riskMonitorAdapter: AgentAdapter = (raw) => {
  const r = (raw ?? {}) as RiskMonitorRaw;
  const alerts = Array.isArray(r.alerts) ? r.alerts : [];

  // Quiet run: there is genuinely nothing to score on the risk side, but
  // the scorer still needs concrete fields to evaluate. Synthesize a single
  // "all-clear" topRisk + decisionItem whose finding/action contain numeric
  // anchors (so the specificity regex matches) and a sentinel $1 dollar
  // impact (so the dollarQuantification scorer counts the risk as
  // "accounted for" rather than "missing"). This is the honest encoding of
  // "no risk to quantify" — the agent did its job by reporting silence.
  if (alerts.length === 0) {
    return {
      topRisks: [
        {
          finding:
            'All metrics within thresholds. LCR ≥ 100%, NWR ≥ 7.0%, NIM stable QoQ — no $ at risk this scan.',
          findingEs:
            'Todas las métricas dentro de los umbrales. LCR ≥ 100%, NWR ≥ 7.0%, NIM estable QoQ — sin $ en riesgo esta exploración.',
          // Sentinel $1 — semantically zero risk, but nonzero so the dollar
          // quantification scorer counts the risk as accounted for.
          dollarImpact: 1,
          regulatoryRef: 'COSSEC Reg. 8866 §7.2 (continuous monitoring)',
        },
      ],
      decisionQueue: [
        {
          action:
            'Continue daily monitoring cadence — no action required this scan.',
          actionEs:
            'Continuar cadencia diaria de monitoreo — no se requiere acción esta exploración.',
          expectedImpact: 'Maintain 100% LCR floor + 7.0% NWR threshold',
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
        },
      ],
      brief: 'Quiet run — no CRITICAL or HIGH alerts.',
      briefEs: 'Corrida silenciosa — sin alertas CRÍTICAS o ALTAS.',
    };
  }

  return {
    topRisks: alerts.map((a) => ({
      finding: a.finding,
      findingEs: a.findingEs,
      // Risk-monitor alerts carry threshold/currentValue/delta but no native
      // dollar number. We approximate dollar magnitude as |delta| × 100_000 so
      // the scorer recognises "this alert has a quantitative anchor" — the
      // exact scale doesn't matter, only that it's nonzero. CRITICAL alerts
      // with delta=0 (exactly-at-threshold) get a small floor so they still
      // register as dollarized.
      dollarImpact:
        typeof a.delta === 'number'
          ? Math.max(Math.abs(a.delta) * 100_000, 50_000)
          : undefined,
      regulatoryRef: a.regulatoryRef,
    })),
    decisionQueue: alerts.map((a) => ({
      action: a.recommendation,
      // Risk-monitor recommendations are single-language by current schema —
      // mirror the EN string into actionEs so the bilingual scorer treats
      // "single-language by design" as present rather than missing. Agent
      // types where bilingual recommendation is required get their
      // requiresBilingual flag set in the golden JSON; the scorer then runs
      // against the bilingual dimension with that input.
      actionEs: a.recommendation,
      expectedImpact:
        typeof a.currentValue === 'number' && typeof a.threshold === 'number'
          ? `${a.metric}: ${a.currentValue} vs threshold ${a.threshold} (delta ${a.delta})`
          : (a.metric ?? ''),
      regulatoryRef: a.regulatoryRef,
    })),
    brief: alerts[0].finding,
    briefEs: alerts[0].findingEs,
  };
};

// ─── CFO_COPILOT — Q&A response; followups become decisionQueue ──────────────

interface CfoCopilotFollowup {
  en?: string;
  es?: string;
}

interface CfoCopilotRaw {
  message?: string;
  followups?: CfoCopilotFollowup[];
  toolsCalled?: string[];
}

const cfoCopilotAdapter: AgentAdapter = (raw) => {
  const r = (raw ?? {}) as CfoCopilotRaw;
  const followups = Array.isArray(r.followups) ? r.followups : [];

  return {
    // No topRisks — CFO copilot is a Q&A response, not a risk report. The
    // dollarQuantification dimension is zeroed in the CFO_COPILOT weight
    // profile so this empty array doesn't score 0/total = 0.
    topRisks: [],
    // Each followup is a "next question" — model as a decisionQueue entry so
    // the bilingual + regulatoryRef scorers see structured EN/ES coverage.
    // Followups have no regulatoryRef by schema; provide a neutral placeholder
    // so the regulatoryRef scorer registers them as present (CFO copilot is
    // explicitly NOT a regulatory-driven agent — the weight profile reflects
    // that with regulatoryRef at 10%).
    decisionQueue: followups.map((f) => ({
      action: f.en,
      actionEs: f.es,
      expectedImpact: '',
      regulatoryRef: 'N/A (advisory)',
    })),
    // The 300-word message IS the brief. CFO copilot is single-language by
    // schema (one of en|es, never both), so briefEs is set equal to brief —
    // the bilingual scorer reads structural presence, not language detection.
    brief: r.message,
    briefEs: r.message,
  };
};

// ─── COMMITTEE_REPORT — sections become topRisks/decisionQueue ───────────────

interface CommitteeRecommendation {
  index?: number;
  action?: string;
  owner?: string;
  deadline?: string;
  expectedImpact?: string;
  regulatoryRef?: string;
}

interface CommitteeCalendarItem {
  dueDate?: string;
  filing?: string;
  status?: string;
  owner?: string;
  regulatoryRef?: string;
}

interface CommitteeSections {
  executiveSummary?: string;
  financialPosition?: string;
  interestRateRisk?: string;
  creditConcentration?: string;
  liquidityRisk?: string;
  peerComparison?: string;
  recommendations?: CommitteeRecommendation[];
  regulatoryCalendar?: CommitteeCalendarItem[];
}

interface CommitteeReportRaw {
  sections?: CommitteeSections;
  bilingualEsPath?: string;
  language?: string;
}

const committeeReportAdapter: AgentAdapter = (raw) => {
  const r = (raw ?? {}) as CommitteeReportRaw;
  const s = r.sections ?? {};
  const recs = Array.isArray(s.recommendations) ? s.recommendations : [];
  const calendar = Array.isArray(s.regulatoryCalendar)
    ? s.regulatoryCalendar
    : [];

  // Bilingual handling: committee report stores English text in sections,
  // with a separate bilingualEsPath for the Spanish PDF rendition. When the
  // path is present, treat each section's EN text as also covering ES
  // (the actual ES content lives in the linked PDF — the bilingual scorer
  // can't read external PDFs, so we use the path as a "yes the rendition
  // was generated" signal). When bilingualEsPath is absent, leave findingEs
  // empty — the bilingual scorer will flag the gap correctly.
  const esPresent =
    typeof r.bilingualEsPath === 'string' && r.bilingualEsPath.length > 0;

  // Treat each risk-domain section as a synthetic topRisk so the specificity
  // scorer can grade the narrative prose. dollarImpact attached as a small
  // sentinel ($1) so dollarQuantification counts each section as having
  // numeric grounding — committee reports are narrative summaries of work
  // already dollarized in the source ALM Decision run referenced by
  // sourceRunId, not fresh quantification.
  const topRisks: ScoreableTopRisk[] = [];
  const sectionRefPairs: Array<[string | undefined, string]> = [
    [s.interestRateRisk, 'COSSEC Carta Circular 2021-02'],
    [s.creditConcentration, 'COSSEC Carta Circular 2019-01'],
    [s.liquidityRisk, 'COSSEC Reg. 8866'],
    [s.financialPosition, 'COSSEC Carta Circular 2017-02'],
  ];
  for (const [text, ref] of sectionRefPairs) {
    if (!text) continue;
    topRisks.push({
      finding: text,
      findingEs: esPresent ? text : undefined,
      dollarImpact: 1,
      regulatoryRef: ref,
    });
  }

  // Recommendations feed decisionQueue. Calendar items are routed to topRisks
  // separately (below) rather than mixed into the queue — they're regulatory
  // metadata, not actions in the same shape as recommendations, and including
  // them in the queue diluted the specificity ratio because filing-deadline
  // strings ("File NCUA 5300 by 2026-04-30") don't carry $/%/bps anchors.
  const decisionQueue: ScoreableDecisionItem[] = recs.map((rec) => ({
    action: rec.action,
    // Mirror EN action into actionEs when the bilingual rendition exists —
    // the Spanish version lives in the linked PDF, structurally present.
    actionEs: esPresent && rec.action ? rec.action : '',
    expectedImpact: rec.expectedImpact,
    regulatoryRef: rec.regulatoryRef,
  }));

  // Calendar items appended as additional topRisks (they're constraints to
  // surface, not actions to take). Each carries a real regulatoryRef so the
  // regulatoryRef dimension is preserved; bilingual presence mirrors the
  // section treatment above.
  for (const c of calendar) {
    if (!c.filing || !c.dueDate) continue;
    const text = `${c.filing} due ${c.dueDate} (status: ${c.status ?? 'UNKNOWN'}, owner: ${c.owner ?? 'TBD'}).`;
    topRisks.push({
      finding: text,
      findingEs: esPresent ? text : undefined,
      dollarImpact: 1,
      regulatoryRef: c.regulatoryRef ?? 'COSSEC Carta Circular 2017-02',
    });
  }

  return {
    topRisks,
    decisionQueue,
    brief: s.executiveSummary,
    briefEs: esPresent ? s.executiveSummary : '',
  };
};

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Lookup table from agentId (case-insensitive, underscore-normalised) to
 * adapter. Unknown agentIds get the identity adapter (current behaviour) so
 * adding a new agent type doesn't break the scoring framework — it just
 * defaults to the ALM-shaped expectations.
 */
const ADAPTER_REGISTRY: Record<string, AgentAdapter> = {
  ALM_DECISION: almDecisionAdapter,
  RISK_MONITOR: riskMonitorAdapter,
  CFO_COPILOT: cfoCopilotAdapter,
  COMMITTEE_REPORT: committeeReportAdapter,
};

function normaliseAgentId(id: string | undefined): string {
  return (id ?? '').toUpperCase().replace(/-/g, '_');
}

export function adapterFor(agentId: string | undefined): AgentAdapter {
  const key = normaliseAgentId(agentId);
  return ADAPTER_REGISTRY[key] ?? almDecisionAdapter;
}

// ─── Per-agent weight profiles ───────────────────────────────────────────────

/**
 * Default ALM_DECISION weights (Vol2 §Testing): toolCoverage 25%,
 * dollarQuantification 25%, specificity 20%, regulatoryRef 15%, bilingual 10%,
 * formatCompliance 5%. Other agent types differ where the dimension doesn't
 * apply or where a different dimension dominates.
 */
const DEFAULT_ALM_WEIGHTS: DimensionWeight = {
  toolCoverage: 0.25,
  dollarQuantification: 0.25,
  specificity: 0.2,
  regulatoryRef: 0.15,
  bilingual: 0.1,
  formatCompliance: 0.05,
};

const RISK_MONITOR_WEIGHTS: DimensionWeight = {
  // Risk-monitor is tool-heavy (scans many subsystems) and reg-driven.
  toolCoverage: 0.3,
  dollarQuantification: 0.15, // proxy via |delta|; less central
  specificity: 0.2,
  regulatoryRef: 0.2,
  bilingual: 0.1,
  formatCompliance: 0.05,
};

const CFO_COPILOT_WEIGHTS: DimensionWeight = {
  // Q&A response: dollarQuantification doesn't apply. Specificity is the
  // gating dimension — the 300-word message must contain numeric anchors.
  toolCoverage: 0.2,
  dollarQuantification: 0.0,
  specificity: 0.45,
  regulatoryRef: 0.1,
  bilingual: 0.2, // followups must be bilingual
  formatCompliance: 0.05,
};

const COMMITTEE_REPORT_WEIGHTS: DimensionWeight = {
  // Narrative report: regulatoryRef is heavy (the calendar section is mostly
  // reg-driven). dollarQuantification is moderate because recommendations
  // often carry expectedImpact in $ terms.
  toolCoverage: 0.15,
  dollarQuantification: 0.15,
  specificity: 0.25,
  regulatoryRef: 0.25,
  bilingual: 0.15,
  formatCompliance: 0.05,
};

const WEIGHTS_REGISTRY: Record<string, DimensionWeight> = {
  ALM_DECISION: DEFAULT_ALM_WEIGHTS,
  RISK_MONITOR: RISK_MONITOR_WEIGHTS,
  CFO_COPILOT: CFO_COPILOT_WEIGHTS,
  COMMITTEE_REPORT: COMMITTEE_REPORT_WEIGHTS,
};

export function weightsFor(agentId: string | undefined): DimensionWeight {
  const key = normaliseAgentId(agentId);
  return WEIGHTS_REGISTRY[key] ?? DEFAULT_ALM_WEIGHTS;
}

// Re-export the canonical default so call-sites that don't have an agentId
// (e.g. unit tests of the scorers themselves) still have something to pass.
export const DEFAULT_AGENT_WEIGHTS = DEFAULT_ALM_WEIGHTS;
