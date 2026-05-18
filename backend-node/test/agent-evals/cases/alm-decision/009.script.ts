import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case 009: Hurricane PR catastrophic overlay.
 *
 * Post-hurricane Maria-type scenario: 40% collateral haircut on real estate,
 * 30% deposit flight, 200bps rate spike, CAMEL downgrade trigger. Tests the
 * agent's ability to synthesize catastrophic-scenario data from multiple
 * models and produce a crisis-grade decision brief. FFIEC Business Continuity
 * regulatory ref required. topRiskDomain is null — the case requires the
 * agent to surface multiple correlated catastrophic risks rather than pick
 * a headline.
 *
 * Turn sequence:
 *   1. runFullSwarm
 *   2. runRateShock + getLCR (parallel — funding + duration under stress)
 *   3. getCapitalAdequacy + getCECL (loss-absorbing capacity)
 *   4. getConcentration + getRepricingGap
 *   5. runMonteCarlo (worst-case tail)
 *   6. final output (end_turn)
 *
 * 8 tool calls — meets minToolsCalled=8 in 009.json.
 * Required tools: runFullSwarm, runRateShock, getLCR, getCapitalAdequacy.
 * Bilingual required.
 */
export default script()
  .forCase('alm-009', 'Hurricane PR catastrophic — multi-risk overlay — 6-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: {
          institutionId: 'golden-inst-001',
          scenarioOverlay: 'hurricane-pr-cat5',
        },
      },
    ],
    { inputTokens: 3400, outputTokens: 160 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'runRateShock',
        input: {
          institutionId: 'golden-inst-001',
          shockBps: [200, 300, 400, -100],
        },
      },
      {
        id: 'tc_003',
        name: 'getLCR',
        input: {
          institutionId: 'golden-inst-001',
          stressOverlay: 'deposit-flight-30pct',
        },
      },
    ],
    { inputTokens: 4800, outputTokens: 130 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getCapitalAdequacy',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_005',
        name: 'getCECL',
        input: {
          institutionId: 'golden-inst-001',
          stressOverlay: 'real-estate-40pct-haircut',
        },
      },
    ],
    { inputTokens: 5600, outputTokens: 120 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_006',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_007',
        name: 'getRepricingGap',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 6200, outputTokens: 95 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_008',
        name: 'runMonteCarlo',
        input: {
          institutionId: 'golden-inst-001',
          scenarios: 10000,
          tailPercentile: 99,
        },
      },
    ],
    { inputTokens: 6800, outputTokens: 90 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'alm_decision',
      version: '2.0',
      runId: 'eval-009',
      institutionId: 'golden-inst-001',
      timestamp: '2026-04-15T10:00:00.000Z',
      language: 'bilingual',
      scenarioOverlay: 'hurricane-pr-cat5',
      healthSnapshot: {
        overall: 28,
        capital: 22,
        liquidity: 18,
        rateRisk: 32,
        credit: 24,
        concentration: 34,
        label: 'CRITICAL',
        trend: 'deteriorating',
      },
      topRisks: [
        {
          rank: 1,
          domain: 'Liquidity Risk',
          priorityScore: 38,
          severity: 'CRITICAL',
          finding:
            'Stressed LCR 62% under 30% deposit-flight overlay — breaches 100% regulatory floor by 38pp. HQLA buffer of $8.2M consumed in 14 days at observed Maria-era outflow velocity ($580K/day net). Wholesale-funding capacity at FHLB capped at $12M; current draw 0 but counterparty discipline is unknown under PR-wide event.',
          findingEs:
            'LCR estresado 62% bajo escenario de fuga de depósitos 30% — viola piso regulatorio de 100% por 38pp. Buffer HQLA de $8.2M consumido en 14 días a velocidad de salida tipo Maria ($580K/día neto). Capacidad de fondeo mayorista en FHLB topada en $12M; uso actual 0 pero disciplina de contraparte desconocida bajo evento PR-amplio.',
          dollarImpact: 8200000,
          dollarImpactPct: 24.2,
          regulatoryRef: 'COSSEC Reg. 8866 §7.2 + FFIEC BCP Booklet §V',
          toolsUsed: ['runFullSwarm', 'getLCR', 'runMonteCarlo'],
        },
        {
          rank: 2,
          domain: 'Capital Adequacy',
          priorityScore: 34,
          severity: 'CRITICAL',
          finding:
            'Net worth ratio drops from 7.6% to 4.1% under combined 40% RE collateral haircut + CECL re-estimation. Crosses 5.0% undercapitalized line, triggering NCUA PCA §702.302 restoration plan within 45 days. Estimated $6.4M of capital erosion driven by $4.8M CECL increase + $1.6M unrealized AFS hit at +300bps.',
          findingEs:
            'Razón de patrimonio neto baja de 7.6% a 4.1% bajo escenario combinado de 40% reducción de garantía RE + recálculo CECL. Cruza línea sub-capitalizada de 5.0%, gatillando plan de restauración NCUA PCA §702.302 en 45 días. Erosión de capital estimada en $6.4M por aumento CECL de $4.8M + golpe AFS no realizado de $1.6M a +300bps.',
          dollarImpact: 6400000,
          dollarImpactPct: 18.9,
          regulatoryRef: 'NCUA §702.302 PCA + FFIEC BCP §VII',
          toolsUsed: ['runFullSwarm', 'getCapitalAdequacy', 'getCECL'],
        },
        {
          rank: 3,
          domain: 'Credit Risk',
          priorityScore: 30,
          severity: 'CRITICAL',
          finding:
            'CECL allowance must grow from $5.2M to $10.0M (+$4.8M) under hurricane stress — 40% RE collateral haircut + +60% PD on auto-loan book with damaged collateral. Loan-loss provision in P&L cycle 1 is $4.8M, exceeding 12-month earnings power of $3.1M.',
          findingEs:
            'Reserva CECL debe crecer de $5.2M a $10.0M (+$4.8M) bajo estrés de huracán — 40% reducción de garantía RE + +60% PD en cartera de auto con garantía dañada. Provisión de pérdida en P&L ciclo 1 es $4.8M, excede poder de ganancia 12 meses de $3.1M.',
          dollarImpact: 4800000,
          dollarImpactPct: 14.2,
          regulatoryRef: 'ASC 326-20 + FFIEC BCP Disaster Guidance',
          toolsUsed: ['runFullSwarm', 'getCECL', 'runMonteCarlo'],
        },
        {
          rank: 4,
          domain: 'Interest Rate Risk',
          priorityScore: 24,
          severity: 'HIGH',
          finding:
            'Combined +300bps rate spike (Fed emergency hike) + duration −1.8yr drives −7.2% NII or $2.4M. Auto-loan concentration at fixed rates extends the impact. AFS portfolio unrealized loss $1.6M.',
          findingEs:
            'Choque combinado de +300bps (alza de emergencia de la Fed) + duración −1.8yr lleva NII a −7.2% o $2.4M. Concentración de préstamos auto a tasa fija extiende el impacto. Pérdida no realizada AFS $1.6M.',
          dollarImpact: 2400000,
          dollarImpactPct: 7.1,
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          toolsUsed: ['runFullSwarm', 'runRateShock', 'getRepricingGap'],
        },
        {
          rank: 5,
          domain: 'Concentration Risk',
          priorityScore: 20,
          severity: 'HIGH',
          finding:
            'Real estate exposure 38% of loans concentrated in San Juan / Bayamón metro (correlated hurricane impact). Auto-loan book 32% — also correlated via member-employment shocks. Combined correlated risk 70% of loan book exposed to a single weather event.',
          findingEs:
            'Exposición inmobiliaria 38% de préstamos concentrada en San Juan / Bayamón metro (impacto huracán correlacionado). Cartera auto 32% — también correlacionada vía choques de empleo de socios. Riesgo correlacionado combinado 70% de la cartera expuesta a un evento meteorológico único.',
          dollarImpact: 1900000,
          dollarImpactPct: 5.6,
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV + FFIEC BCP §III',
          toolsUsed: ['runFullSwarm', 'getConcentration'],
        },
      ],
      decisionQueue: [
        {
          priority: 1,
          action:
            'Activate Business Continuity Plan within 24h of NWS Cat-4 watch; pre-draw $8M of FHLB capacity; suspend new commercial lending; freeze discretionary expenses to preserve $400K/month.',
          actionEs:
            'Activar Plan de Continuidad de Negocio dentro de 24h del aviso NWS Cat-4; pre-extraer $8M de capacidad FHLB; suspender nuevos préstamos comerciales; congelar gastos discrecionales para preservar $400K/mes.',
          expectedImpact:
            'LCR cushion +$8M (lifts stressed LCR from 62% to 96%); +$400K/month capital preservation',
          deadline: '24h',
          owner: 'BOARD',
          regulatoryRef: 'FFIEC BCP Booklet §V + NCUA Letter 17-CU-09',
          status: 'PENDING',
        },
        {
          priority: 2,
          action:
            'File NCUA Capital Restoration Plan (NCUA §702.302) within 45 days of any PCA trigger; engage external CECL consultant for hurricane-adjusted methodology.',
          actionEs:
            'Presentar Plan de Restauración de Capital NCUA (§702.302) dentro de 45 días de cualquier gatillo PCA; contratar consultor externo CECL para metodología ajustada por huracán.',
          expectedImpact:
            'Regulatory compliance; restoration glidepath; CECL methodology defensible',
          deadline: '45d',
          owner: 'BOARD',
          regulatoryRef: 'NCUA §702.302 + ASC 326-20',
          status: 'PENDING',
        },
        {
          priority: 3,
          action:
            'Reduce RE concentration: cap new real estate originations at 25% of total loans for 24 months; shift to consumer/personal segments with $25K limits.',
          actionEs:
            'Reducir concentración inmobiliaria: limitar nuevas originaciones RE al 25% de préstamos totales por 24 meses; mover a segmentos personales/consumo con límites de $25K.',
          expectedImpact:
            'RE concentration to 28% in 12 months; correlated-risk exposure to 55%',
          deadline: '12mo',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          status: 'PENDING',
        },
        {
          priority: 4,
          action:
            'Increase HQLA buffer to 18% of total assets ($12M target, +$3.8M from current) via Treasury bills + Fed RRP; lock in 25bps overnight floor.',
          actionEs:
            'Aumentar buffer HQLA a 18% de activos totales (objetivo $12M, +$3.8M sobre actual) vía letras del Tesoro + Fed RRP; asegurar piso overnight de 25bps.',
          expectedImpact:
            'Pre-stress LCR to 145%; stressed LCR 75% (still breach but smaller)',
          deadline: '90d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
          status: 'PENDING',
        },
        {
          priority: 5,
          action:
            'Hedge rate risk: enter $15M notional 2-year pay-fixed receive-floating swap to neutralize the −1.8yr duration mismatch.',
          actionEs:
            'Cubrir riesgo de tasa: entrar swap de $15M nocional 2 años pagar-fijo recibir-flotante para neutralizar desajuste de duración de −1.8yr.',
          expectedImpact:
            'Duration gap to −0.5yr; +200bps shock NII impact halved',
          deadline: '60d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2021-02 + ASC 815',
          status: 'PENDING',
        },
      ],
      brief:
        'Hurricane PR Cat-4/5 overlay produces a crisis-grade outlook. Stressed LCR drops to 62% (38pp below floor), net worth ratio falls to 4.1% (undercapitalized, triggering NCUA PCA), CECL must grow $4.8M, and 70% of the loan book is correlated to a single weather event. The 5-item action queue prioritises BCP activation + FHLB pre-draw in the first 24 hours, NCUA PCA restoration filing within 45 days, structural concentration caps and HQLA buffer growth over 3-12 months, and a rate-risk swap to neutralise the worst duration component. Total quantified loss exposure $23.7M; total mitigation cost ~$1.4M.',
      briefEs:
        'El escenario de huracán PR Cat-4/5 produce un panorama de crisis. LCR estresado baja a 62% (38pp bajo piso), razón de patrimonio neto cae a 4.1% (sub-capitalizado, gatilla PCA NCUA), CECL debe crecer $4.8M, y 70% de la cartera está correlacionada con un evento meteorológico único. La cola de acción de 5 elementos prioriza activación BCP + pre-extracción FHLB en las primeras 24 horas, presentación de plan de restauración PCA NCUA en 45 días, límites estructurales de concentración y crecimiento de buffer HQLA en 3-12 meses, y un swap de riesgo de tasa para neutralizar el peor componente de duración. Exposición total cuantificada $23.7M; costo total de mitigación ~$1.4M.',
      auditTraceId: 'eval-trace-009',
    }),
    { inputTokens: 7200, outputTokens: 2400 },
  )

  .build();
