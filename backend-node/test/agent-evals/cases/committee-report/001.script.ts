import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case committee-001: Bilingual Board committee
 * report generated from a prior ALM Decision run.
 *
 * Output shape: CommitteeReportOutputSchema (src/agents/contracts/committee-report.contracts.ts)
 *   - agentId, sourceRunId, committeeType: 'board', language: 'bilingual'
 *   - sections.{executiveSummary (≤150 words), financialPosition,
 *     interestRateRisk, creditConcentration, liquidityRisk, peerComparison,
 *     recommendations[], regulatoryCalendar[]}
 *   - pdfPath, wordCount, bilingualEsPath (optional)
 *
 * Turn sequence:
 *   1. runFullSwarm (re-fetch latest swarm for narrative — committee reports
 *      go to the board so we want freshest numbers, not just sourceRunId
 *      output blob)
 *   2. final output (end_turn) — full sections JSON
 *
 * 1 tool call — meets minToolsCalled=1 in 001.json. No required tools.
 * Bilingual required.
 */
export default script()
  .forCase('committee-001', 'Board committee report — bilingual — 2-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 3400, outputTokens: 140 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'committee_report',
      sourceRunId: 'golden-alm-run-001',
      committeeType: 'board',
      language: 'bilingual',
      sections: {
        executiveSummary:
          'The institution remains within COSSEC policy on liquidity, capital, and credit, but interest rate risk has crossed the internal IRR ceiling at +200bps NII sensitivity 5.8% (policy 5.5%). The recommended package shifts $15M of fixed-rate auto loan production to variable, lifts the HQLA buffer by $2M, and caps auto concentration at 30% of total portfolio. Quantified annual benefit is $840K of NIM uplift with no additional regulatory capital required. No CRITICAL findings this quarter.',
        financialPosition:
          'Total assets $338M (+2.1% QoQ). Loans $214M, deposits $268M, member capital $25.6M (net worth ratio 7.6%, well-capitalized). Liquidity buffer $42M HQLA = 12.4% of assets. Reporting period closed 2026-03-31. Currency: USD throughout.',
        interestRateRisk:
          'NII +200bps sensitivity 5.8% — 80bps above COSSEC IRR policy limit. Repricing gap −1.4yr driven by 3–5 year fixed-rate auto loan concentration ($98M, 46% of loans). EVE −1.2% under +200bps shock — within tolerance but trending wider. Recommended: $15M shift to variable-rate auto loans over 60 days. Reg ref: COSSEC Carta Circular 2021-02 §III.B.',
        creditConcentration:
          'Auto loan sector HHI 2,720 — over internal 2,500 limit. Top-15 member exposure 9.4% of net worth (internal limit 7%). CECL coverage 1.42% vs peer median 1.58% — under-reserved $440K. Reg ref: COSSEC Carta Circular 2019-01 §IV; ASC 326-20.',
        liquidityRisk:
          'LCR 122% (floor 100%); NSFR 108%; deposit beta 0.62 (peer median 0.65). No CRITICAL findings. Non-maturity deposits stable QoQ. Reg ref: COSSEC Reg. 8866 §7.2.',
        peerComparison:
          'Peer group: 12 PR cooperativas, $200M–$400M assets. CerniQ is at peer median on capital (7.6% vs 7.7%) and liquidity (LCR 122% vs 124%) but lags on CECL coverage (1.42% vs 1.58%) and is +30bps tighter on NIM compression (3.18% vs 3.21%). Position ranking 6/12 overall.',
        recommendations: [
          {
            index: 1,
            action:
              'Shift $15M of 5-year fixed auto loan production to 1–2 year variable to bring +200bps NII from 5.8% to 4.7%.',
            owner: 'CFO',
            deadline: '60d',
            expectedImpact:
              '+14bps NIM (+$840K annualized); IRR back within policy',
            regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          },
          {
            index: 2,
            action:
              'Top up CECL allowance by $440K to align with peer median 1.58% coverage.',
            owner: 'CFO',
            deadline: '30d',
            expectedImpact:
              'Coverage gap closed; commercial-RE risk fully accrued',
            regulatoryRef: 'ASC 326-20',
          },
          {
            index: 3,
            action:
              'Cap new auto-loan originations at 30% of total portfolio for 6 months to drift HHI below 2,500.',
            owner: 'ALM_COMMITTEE',
            deadline: '90d',
            expectedImpact:
              'HHI to ~2,420 in 6 months; opens balance-sheet capacity for personal loans',
            regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          },
          {
            index: 4,
            action:
              'Adopt quarterly bilingual board pack — present IRR, concentration, CECL and capital in both Spanish and English (COSSEC examiner expectation).',
            owner: 'BOARD',
            deadline: '90d',
            expectedImpact:
              'COSSEC examiner readiness; member-facing report consistency',
            regulatoryRef: 'COSSEC Carta Circular 2017-02',
          },
        ],
        regulatoryCalendar: [
          {
            dueDate: '2026-04-30',
            filing: 'NCUA 5300 Call Report (Q1 2026)',
            status: 'IN_PREPARATION',
            owner: 'CFO',
            regulatoryRef: 'NCUA Letter 24-CU-01',
          },
          {
            dueDate: '2026-05-15',
            filing: 'COSSEC Quarterly Financial Statement',
            status: 'READY',
            owner: 'CFO',
            regulatoryRef: 'COSSEC Carta Circular 2017-02',
          },
          {
            dueDate: '2026-06-30',
            filing: 'NCUA RBC2 (Risk-Based Capital)',
            status: 'IN_PREPARATION',
            owner: 'CFO',
            regulatoryRef: 'NCUA §702.104',
          },
        ],
      },
      pdfPath: '/reports/golden-inst-001/board-report-2026-Q1.pdf',
      bilingualEsPath: '/reports/golden-inst-001/board-report-2026-Q1-es.pdf',
      wordCount: 1842,
    }),
    { inputTokens: 5200, outputTokens: 2400 },
  )

  .build();
