// verify:no-orphan-spec-skip — integration-scope: locks the per-agent
// adapter + weight registry in test/agent-evals/scoring/adapters.ts. The
// scoring framework itself lives under test/agent-evals/ and is not in
// jest's default rootDir; integration-scope specs that exercise it live
// here in src/__tests__/.
/**
 * Locks the per-agent adapter + weights registry that powers T6.b's
 * non-ALM scoring generalization.
 *
 * Three concerns:
 *   1. Adapter dispatch (registry keys, normalisation, fallback to identity)
 *   2. Adapter output shape (each agent type's raw output normalises to the
 *      common ScoreableOutput shape with the fields the dimension scorers
 *      consume)
 *   3. Weight profiles (each profile sums to 1.0; the lookup falls back to
 *      ALM defaults for unknown agentIds; scoreAgentRun without an agentId
 *      argument behaves identically to before T6.b — backward-compat)
 */
import {
  adapterFor,
  weightsFor,
  DEFAULT_AGENT_WEIGHTS,
} from '../../test/agent-evals/scoring/adapters';
import {
  DEFAULT_WEIGHTS,
  scoreAgentRun,
} from '../../test/agent-evals/scoring/weights';
import type { AuditStep } from '../../test/agent-evals/scoring/dimensions';

// ─── Adapter dispatch ─────────────────────────────────────────────────────────

describe('adapterFor — registry dispatch', () => {
  it('returns identity for ALM_DECISION', () => {
    const adapter = adapterFor('ALM_DECISION');
    const raw = { topRisks: [{ finding: 'x' }] };
    const out = adapter(raw);
    expect(out).toEqual(raw);
  });

  it('case-insensitive (alm_decision → ALM_DECISION)', () => {
    const a = adapterFor('alm_decision');
    const b = adapterFor('ALM_DECISION');
    expect(a({ topRisks: [{ finding: 'x' }] })).toEqual(
      b({ topRisks: [{ finding: 'x' }] }),
    );
  });

  it('dash normalisation (RISK-MONITOR → RISK_MONITOR)', () => {
    const a = adapterFor('RISK-MONITOR');
    const b = adapterFor('RISK_MONITOR');
    const raw = { alerts: [] };
    expect(a(raw)).toEqual(b(raw));
  });

  it('unknown agentId falls back to identity', () => {
    const adapter = adapterFor('NONESUCH_AGENT');
    const raw = { topRisks: [{ finding: 'x', dollarImpact: 100 }] };
    expect(adapter(raw)).toEqual(raw);
  });

  it('undefined agentId returns identity', () => {
    const adapter = adapterFor(undefined);
    const raw = { topRisks: [] };
    expect(adapter(raw)).toEqual(raw);
  });

  it('null/empty raw input does not throw', () => {
    expect(() => adapterFor('RISK_MONITOR')(null)).not.toThrow();
    expect(() => adapterFor('CFO_COPILOT')(undefined)).not.toThrow();
    expect(() => adapterFor('COMMITTEE_REPORT')({})).not.toThrow();
  });
});

// ─── RISK_MONITOR adapter output ─────────────────────────────────────────────

describe('riskMonitorAdapter', () => {
  it('quiet run synthesizes a sentinel topRisk + decisionItem with full coverage', () => {
    const out = adapterFor('RISK_MONITOR')({
      agentId: 'risk_monitor',
      alerts: [],
      alertCount: 0,
      quietRun: true,
    });
    expect(out.topRisks).toHaveLength(1);
    expect(out.topRisks?.[0].dollarImpact).toBeGreaterThan(0);
    expect(out.topRisks?.[0].findingEs).toBeTruthy();
    expect(out.topRisks?.[0].regulatoryRef).toMatch(/COSSEC/);
    expect(out.decisionQueue).toHaveLength(1);
    expect(out.decisionQueue?.[0].actionEs).toBeTruthy();
    expect(out.brief).toBeTruthy();
    expect(out.briefEs).toBeTruthy();
  });

  it('alerts map 1:1 to topRisks with dollarImpact derived from |delta|', () => {
    const out = adapterFor('RISK_MONITOR')({
      agentId: 'risk_monitor',
      alerts: [
        {
          category: 'liquidity',
          severity: 'CRITICAL',
          metric: 'LCR',
          currentValue: 94,
          threshold: 100,
          delta: -6,
          trend: 'worsening',
          finding: 'LCR breach',
          findingEs: 'Brecha LCR',
          recommendation: 'File COSSEC L-2',
          regulatoryRef: 'COSSEC Reg. 8866',
          deadline: '2026-06-16',
          dedupSeed: 'lcr-q2',
        },
        {
          category: 'capital',
          severity: 'MEDIUM',
          metric: 'NWR',
          currentValue: 7.1,
          threshold: 7.0,
          delta: 0.1,
          trend: 'stable',
          finding: 'NWR margin thin',
          findingEs: 'Margen NWR estrecho',
          recommendation: 'Suspend dividend',
          regulatoryRef: 'NCUA §702.102',
          deadline: '2026-07-15',
          dedupSeed: 'nwr-q2',
        },
      ],
      alertCount: 2,
      quietRun: false,
    });
    expect(out.topRisks).toHaveLength(2);
    // |delta=-6| × 100_000 = 600_000
    expect(out.topRisks?.[0].dollarImpact).toBe(600_000);
    // |delta=0.1| × 100_000 = 10_000 → but with the 50k floor → 50_000
    expect(out.topRisks?.[1].dollarImpact).toBe(50_000);
    expect(out.decisionQueue).toHaveLength(2);
    expect(out.brief).toBe('LCR breach');
    expect(out.briefEs).toBe('Brecha LCR');
  });
});

// ─── CFO_COPILOT adapter output ──────────────────────────────────────────────

describe('cfoCopilotAdapter', () => {
  it('empty followups produce empty decisionQueue', () => {
    const out = adapterFor('CFO_COPILOT')({
      agentId: 'cfo_copilot',
      message: 'A short answer.',
      followups: [],
    });
    expect(out.decisionQueue).toHaveLength(0);
    expect(out.topRisks).toHaveLength(0);
    expect(out.brief).toBe('A short answer.');
    expect(out.briefEs).toBe('A short answer.');
  });

  it('followups become bilingual decisionQueue entries', () => {
    const out = adapterFor('CFO_COPILOT')({
      message: '+200bps shock compresses NII by 6.2% ($2.1M).',
      followups: [
        { en: 'What about -100bps?', es: '¿Y a -100bps?' },
        { en: 'Show duration heatmap', es: 'Muestra mapa de duración' },
      ],
    });
    expect(out.decisionQueue).toHaveLength(2);
    expect(out.decisionQueue?.[0].action).toBe('What about -100bps?');
    expect(out.decisionQueue?.[0].actionEs).toBe('¿Y a -100bps?');
    expect(out.brief).toBe('+200bps shock compresses NII by 6.2% ($2.1M).');
  });
});

// ─── COMMITTEE_REPORT adapter output ─────────────────────────────────────────

describe('committeeReportAdapter', () => {
  it('sections without bilingualEsPath leave findingEs empty', () => {
    const out = adapterFor('COMMITTEE_REPORT')({
      sections: {
        executiveSummary: 'Healthy posture.',
        financialPosition: 'Assets $338M.',
        interestRateRisk: 'NII +200bps at 3.9%.',
        creditConcentration: 'HHI 2,720.',
        liquidityRisk: 'LCR 122%.',
        peerComparison: 'Median.',
        recommendations: [
          {
            index: 1,
            action: 'Shift $15M to variable',
            owner: 'CFO',
            deadline: '60d',
            expectedImpact: '+14bps NIM',
            regulatoryRef: 'COSSEC',
          },
        ],
        regulatoryCalendar: [],
      },
    });
    expect(out.briefEs).toBe('');
    expect(out.topRisks?.[0].findingEs).toBeUndefined();
  });

  it('bilingualEsPath set mirrors EN sections into findingEs', () => {
    const out = adapterFor('COMMITTEE_REPORT')({
      bilingualEsPath: '/reports/board-es.pdf',
      sections: {
        executiveSummary: 'Healthy posture.',
        interestRateRisk: 'NII +200bps at 3.9%.',
        creditConcentration: 'HHI 2,720.',
        liquidityRisk: 'LCR 122%.',
        financialPosition: 'Assets $338M.',
        peerComparison: 'Median.',
        recommendations: [],
        regulatoryCalendar: [],
      },
    });
    expect(out.briefEs).toBe('Healthy posture.');
    for (const r of out.topRisks ?? []) {
      expect(r.findingEs).toBeTruthy();
    }
  });

  it('regulatoryCalendar items become additional topRisks', () => {
    const out = adapterFor('COMMITTEE_REPORT')({
      bilingualEsPath: '/reports/board-es.pdf',
      sections: {
        executiveSummary: 'x',
        interestRateRisk: 'x',
        creditConcentration: 'x',
        liquidityRisk: 'x',
        financialPosition: 'x',
        peerComparison: 'x',
        recommendations: [],
        regulatoryCalendar: [
          {
            dueDate: '2026-04-30',
            filing: 'NCUA 5300',
            status: 'IN_PREPARATION',
            owner: 'CFO',
            regulatoryRef: 'NCUA Letter 24-CU-01',
          },
        ],
      },
    });
    // 4 sections + 1 calendar item = 5 topRisks
    expect(out.topRisks).toHaveLength(5);
    expect(out.topRisks?.[4].finding).toContain('NCUA 5300');
  });
});

// ─── Per-agent weight profiles ───────────────────────────────────────────────

describe('weightsFor — registry dispatch', () => {
  it.each([
    ['ALM_DECISION'],
    ['RISK_MONITOR'],
    ['CFO_COPILOT'],
    ['COMMITTEE_REPORT'],
  ])('%s weights sum to 1.0', (agentId) => {
    const w = weightsFor(agentId);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('CFO_COPILOT zeros dollarQuantification (not applicable to Q&A)', () => {
    expect(weightsFor('CFO_COPILOT').dollarQuantification).toBe(0);
  });

  it('CFO_COPILOT pins specificity at 45% (the gating dimension)', () => {
    expect(weightsFor('CFO_COPILOT').specificity).toBe(0.45);
  });

  it('COMMITTEE_REPORT raises regulatoryRef to 25%', () => {
    expect(weightsFor('COMMITTEE_REPORT').regulatoryRef).toBe(0.25);
  });

  it('unknown agentId falls back to ALM defaults', () => {
    expect(weightsFor('NONESUCH')).toEqual(DEFAULT_AGENT_WEIGHTS);
  });

  it('DEFAULT_AGENT_WEIGHTS equals DEFAULT_WEIGHTS from weights.ts', () => {
    expect(DEFAULT_AGENT_WEIGHTS).toEqual(DEFAULT_WEIGHTS);
  });
});

// ─── Backward-compat — scoreAgentRun without agentId ─────────────────────────

describe('scoreAgentRun — backward compatibility', () => {
  const trace: AuditStep[] = Array.from({ length: 6 }, (_, i) => ({
    stepKind: 'TOOL_CALL',
    toolName: `tool${i}`,
    toolOutput: null,
  }));

  const almShapedOutput = {
    topRisks: [
      {
        finding: 'NII +200bps at 5.8% ($2.0M)',
        findingEs: 'NII +200bps a 5.8% ($2.0M)',
        dollarImpact: 2_000_000,
        regulatoryRef: 'COSSEC Carta Circular 2021-02',
      },
    ],
    decisionQueue: [
      {
        action: 'Shift $15M to variable',
        actionEs: 'Mover $15M a variable',
        expectedImpact: '+14bps NIM',
        regulatoryRef: 'COSSEC',
      },
    ],
    brief: 'IRR is elevated.',
    briefEs: 'IRR elevado.',
  };

  it('scores identically when called without agentId vs with ALM_DECISION', () => {
    const withoutAgent = scoreAgentRun(almShapedOutput, trace, {
      minToolsCalled: 6,
      requiresBilingual: true,
    });
    const withAlm = scoreAgentRun(
      almShapedOutput,
      trace,
      { minToolsCalled: 6, requiresBilingual: true },
      DEFAULT_WEIGHTS,
      'ALM_DECISION',
    );
    expect(withoutAgent.total).toBeCloseTo(withAlm.total, 4);
  });

  it('still fails empty output (regression test from eval-runner.spec.ts)', () => {
    const result = scoreAgentRun({}, [], {
      minToolsCalled: 6,
      requiresBilingual: true,
    });
    expect(result.pass).toBe(false);
  });
});
