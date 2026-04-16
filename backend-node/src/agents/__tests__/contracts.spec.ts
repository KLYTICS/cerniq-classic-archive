import { ALMDecisionOutputSchema } from '../contracts/alm-decision.contracts';
import { CFOCopilotOutputSchema } from '../contracts/cfo-copilot.contracts';
import { CommitteeReportOutputSchema } from '../contracts/committee-report.contracts';
import { RiskMonitorOutputSchema } from '../contracts/risk-monitor.contracts';

// Sanity fixtures for every agent output contract. These double as examples
// the LLM can reference when we wire structured-output mode in a later PR.

const validDecision = {
  agentId: 'alm_decision',
  version: '2.0',
  runId: 'r_1',
  institutionId: 'inst_1',
  timestamp: '2026-04-15T12:00:00Z',
  language: 'bilingual',
  healthSnapshot: {
    overall: 72,
    capital: 80,
    liquidity: 65,
    rateRisk: 60,
    credit: 75,
    concentration: 80,
    label: 'SATISFACTORY',
    trend: 'stable',
  },
  topRisks: Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    domain: 'Interest Rate Risk',
    priorityScore: 18,
    severity: 'HIGH',
    finding: 'x',
    findingEs: 'x',
    dollarImpact: -2100000,
    dollarImpactPct: -6.2,
    regulatoryRef: 'COSSEC 8917 §4.3',
    toolsUsed: ['runRateShock'],
  })),
  decisionQueue: Array.from({ length: 5 }, (_, i) => ({
    priority: i + 1,
    action: 'Shift $5M from 6m CDs to 2yr loans',
    actionEs: 'Transferir $5M de CDs 6m a préstamos 2yr',
    expectedImpact: '+$420K NII over 12 months',
    deadline: '60d',
    owner: 'CFO',
    regulatoryRef: 'COSSEC 8917 §4.3',
    status: 'PENDING',
  })),
  brief: 'Short brief.',
  briefEs: 'Breve resumen.',
  auditTraceId: 'a_1',
};

describe('ALMDecisionOutputSchema', () => {
  it('accepts a well-formed sample', () => {
    expect(ALMDecisionOutputSchema.safeParse(validDecision).success).toBe(
      true,
    );
  });

  it('rejects a brief over 600 words (Bible §01)', () => {
    const bad = {
      ...validDecision,
      brief: Array.from({ length: 601 }, () => 'word').join(' '),
    };
    const r = ALMDecisionOutputSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('requires exactly 5 topRisks', () => {
    const bad = { ...validDecision, topRisks: validDecision.topRisks.slice(0, 4) };
    expect(ALMDecisionOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('requires exactly 5 decision queue items', () => {
    const bad = {
      ...validDecision,
      decisionQueue: validDecision.decisionQueue.slice(0, 4),
    };
    expect(ALMDecisionOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects priority score outside 1-27', () => {
    const bad = {
      ...validDecision,
      topRisks: [
        { ...validDecision.topRisks[0], priorityScore: 28 },
        ...validDecision.topRisks.slice(1),
      ],
    };
    expect(ALMDecisionOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('CFOCopilotOutputSchema', () => {
  const valid = {
    agentId: 'cfo_copilot',
    runId: 'r_1',
    institutionId: 'inst_1',
    sessionId: 's_1',
    language: 'en',
    message: 'At +150bps, NII drops $1.8M (5.2%).',
    followups: Array.from({ length: 4 }, () => ({
      en: 'Run Monte Carlo',
      es: 'Ejecutar Monte Carlo',
    })),
    toolsCalled: ['runRateShock'],
  };

  it('accepts a valid sample', () => {
    expect(CFOCopilotOutputSchema.safeParse(valid).success).toBe(true);
  });

  it('requires exactly 4 followups (Bible §04)', () => {
    const bad = { ...valid, followups: valid.followups.slice(0, 3) };
    expect(CFOCopilotOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a message over 300 words', () => {
    const bad = {
      ...valid,
      message: Array.from({ length: 301 }, () => 'word').join(' '),
    };
    expect(CFOCopilotOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects bilingual language (copilot is single-lang per turn)', () => {
    const bad = { ...valid, language: 'bilingual' };
    expect(CFOCopilotOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('RiskMonitorOutputSchema', () => {
  it('accepts an empty alerts array (silence is signal)', () => {
    const sample = {
      agentId: 'risk_monitor',
      runId: 'r_1',
      institutionId: 'inst_1',
      scanKind: 'daily',
      alerts: [],
      alertCount: 0,
      quietRun: true,
    };
    expect(RiskMonitorOutputSchema.safeParse(sample).success).toBe(true);
  });

  it('validates alert deadline as ISO date (no time component)', () => {
    const sample = {
      agentId: 'risk_monitor',
      runId: 'r_1',
      institutionId: 'inst_1',
      scanKind: 'daily',
      alertCount: 1,
      quietRun: false,
      alerts: [
        {
          category: 'liquidity',
          severity: 'CRITICAL',
          metric: 'LCR',
          currentValue: 104,
          threshold: 105,
          delta: -1,
          trend: 'worsening',
          finding: 'LCR below threshold',
          findingEs: 'LCR debajo del umbral',
          recommendation: 'Shift cash into HQLA',
          regulatoryRef: 'NCUA 741.8',
          deadline: '2026-04-22T00:00:00Z',
          dedupSeed: 'lcr:critical:105',
        },
      ],
    };
    expect(RiskMonitorOutputSchema.safeParse(sample).success).toBe(false);
  });
});

describe('CommitteeReportOutputSchema', () => {
  const valid = {
    agentId: 'committee_report',
    sourceRunId: 'r_1',
    committeeType: 'board',
    language: 'bilingual',
    sections: {
      executiveSummary: 'short summary.',
      financialPosition: 'x',
      interestRateRisk: 'x',
      creditConcentration: 'x',
      liquidityRisk: 'x',
      peerComparison: 'x',
      recommendations: [
        {
          index: 1,
          action: 'Shift $5M',
          owner: 'CFO',
          deadline: '60d',
          expectedImpact: '+$420K',
          regulatoryRef: 'COSSEC 8917 §4.3',
        },
      ],
      regulatoryCalendar: [],
    },
    pdfPath: '/tmp/x.pdf',
    wordCount: 800,
  };

  it('accepts a valid sample', () => {
    expect(CommitteeReportOutputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an executive summary over 150 words', () => {
    const bad = {
      ...valid,
      sections: {
        ...valid.sections,
        executiveSummary: Array.from({ length: 151 }, () => 'word').join(' '),
      },
    };
    expect(CommitteeReportOutputSchema.safeParse(bad).success).toBe(false);
  });
});
