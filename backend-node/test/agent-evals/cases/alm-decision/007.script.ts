import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case 007: Early-warning composite (amber zone).
 *
 * EWS score 65/100 (amber threshold: 60). Three leading indicators flashing
 * weakly: loan delinquency trend, deposit erosion rate, NIM compression. No
 * single metric is critical — the case gates the agent's ability to fuse
 * multiple weak signals into a pre-crisis recommendation, with topRiskDomain
 * null (synthesis, not headline).
 *
 * Turn sequence:
 *   1. runFullSwarm
 *   2. getEWS + getDepositBeta
 *   3. getCECL + getRepricingGap
 *   4. getPeerBenchmark
 *   5. final output (end_turn)
 *
 * 6 tool calls; required tools: runFullSwarm, getEWS. Bilingual required.
 */
export default script()
  .forCase('alm-007', 'Early warning composite — amber zone synthesis — 5-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 3200, outputTokens: 140 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'getEWS',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_003',
        name: 'getDepositBeta',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 4600, outputTokens: 110 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_005',
        name: 'getRepricingGap',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 5400, outputTokens: 95 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_006',
        name: 'getPeerBenchmark',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 5800, outputTokens: 70 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'alm_decision',
      version: '2.0',
      runId: 'eval-007',
      institutionId: 'golden-inst-001',
      timestamp: '2026-04-15T10:00:00.000Z',
      language: 'bilingual',
      healthSnapshot: {
        overall: 62,
        capital: 72,
        liquidity: 65,
        rateRisk: 60,
        credit: 58,
        concentration: 64,
        label: 'FAIR',
        trend: 'deteriorating',
      },
      topRisks: [
        {
          rank: 1,
          domain: 'Composite Early Warning',
          priorityScore: 22,
          severity: 'MEDIUM',
          finding:
            'EWS composite 65/100 — 5pt above amber threshold. Three signals each amber but combined: delinquency trend +18bps QoQ for 3 quarters (current 1.42%), deposit erosion 4% QoQ in non-maturity, NIM compression 9bps to 3.18%. No single metric critical but the trajectory has $1.8M of annualized impact if it persists 2 more quarters.',
          findingEs:
            'EWS compuesto 65/100 — 5pt sobre umbral amarillo. Tres señales amarillas combinadas: tendencia de morosidad +18bps QoQ por 3 trimestres (actual 1.42%), erosión de depósitos 4% QoQ en sin vencimiento, compresión de NIM 9bps a 3.18%. Trayectoria con impacto anualizado de $1.8M si persiste 2 trimestres más.',
          dollarImpact: 1800000,
          dollarImpactPct: 5.3,
          regulatoryRef: 'NCUA Letter 24-CU-02 EWS Guidance §III',
          toolsUsed: ['runFullSwarm', 'getEWS', 'getCECL'],
        },
        {
          rank: 2,
          domain: 'Credit Risk',
          priorityScore: 17,
          severity: 'MEDIUM',
          finding:
            'Delinquency 1.42% vs peer median 0.98% — 44bps wide and widening. CECL coverage 1.51% vs peer 1.58%.',
          findingEs:
            'Morosidad 1.42% vs mediana de pares 0.98% — 44bps amplio y ampliándose. Cobertura CECL 1.51% vs pares 1.58%.',
          dollarImpact: 740000,
          dollarImpactPct: 2.2,
          regulatoryRef: 'ASC 326-20 + COSSEC Carta Circular 2020-03',
          toolsUsed: ['runFullSwarm', 'getCECL', 'getPeerBenchmark'],
        },
        {
          rank: 3,
          domain: 'Liquidity Risk',
          priorityScore: 13,
          severity: 'MEDIUM',
          finding:
            'Non-maturity deposit erosion 4% QoQ. LCR 124% (healthy) but trend is the tell — peer median for similar-sized cooperativas is +1% QoQ.',
          findingEs:
            'Erosión de depósitos sin vencimiento 4% QoQ. LCR 124% (saludable) pero la tendencia es la señal — mediana de pares para cooperativas similares es +1% QoQ.',
          dollarImpact: 620000,
          dollarImpactPct: 1.8,
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
          toolsUsed: ['runFullSwarm', 'getDepositBeta'],
        },
        {
          rank: 4,
          domain: 'Interest Rate Risk',
          priorityScore: 11,
          severity: 'MEDIUM',
          finding:
            'NIM compression 9bps to 3.18%. Repricing gap −0.6yr — modest mismatch but enough to convert deposit-rate pressure into margin loss.',
          findingEs:
            'Compresión NIM 9bps a 3.18%. Brecha de repreciación −0.6yr — desajuste modesto pero suficiente para convertir presión de tasa de depósito en pérdida de margen.',
          dollarImpact: 480000,
          dollarImpactPct: 1.4,
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          toolsUsed: ['runFullSwarm', 'getRepricingGap'],
        },
        {
          rank: 5,
          domain: 'Capital Adequacy',
          priorityScore: 6,
          severity: 'LOW',
          finding:
            'Net worth 7.5% — 50bps above well-capitalized. Adequate buffer for the synthesized risks above.',
          findingEs:
            'Patrimonio neto 7.5% — 50bps sobre bien capitalizado. Buffer adecuado para los riesgos sintetizados.',
          dollarImpact: 160000,
          dollarImpactPct: 0.5,
          regulatoryRef: 'NCUA §702.102',
          toolsUsed: ['runFullSwarm'],
        },
      ],
      decisionQueue: [
        {
          priority: 1,
          action:
            'Convene Special EWS Review at next ALCO — present composite trend, 3 leading indicators, and 90-day action plan. Add EWS amber-zone watch flag in monthly board pack.',
          actionEs:
            'Convocar Revisión Especial de EWS en el próximo ALCO — presentar tendencia compuesta, 3 indicadores principales, y plan de acción de 90 días. Añadir alerta de zona amarilla EWS en paquete mensual de junta.',
          expectedImpact:
            'Pre-crisis governance lock-in; $1.8M trajectory risk surfaced to board',
          deadline: '14d',
          owner: 'CFO',
          regulatoryRef: 'NCUA Letter 24-CU-02',
          status: 'PENDING',
        },
        {
          priority: 2,
          action:
            'Boost CECL provision by $310K to bring coverage to 1.62% (peer median +5bps). Run CECL re-segmentation on commercial portfolio.',
          actionEs:
            'Aumentar provisión CECL en $310K para llevar cobertura a 1.62% (mediana de pares +5bps). Hacer re-segmentación CECL en cartera comercial.',
          expectedImpact: 'Coverage gap closed; CECL trend signal cleared',
          deadline: '30d',
          owner: 'CFO',
          regulatoryRef: 'ASC 326-20',
          status: 'PENDING',
        },
        {
          priority: 3,
          action:
            'Launch member retention campaign — targeted savings rate +20bps + financial-health touchpoint for top-100 declining-balance members.',
          actionEs:
            'Lanzar campaña de retención de socios — tasa de ahorro objetivo +20bps + punto de contacto de salud financiera para los 100 socios con balance en declive.',
          expectedImpact:
            'Halve deposit erosion from 4% QoQ to 2% QoQ over 60 days',
          deadline: '45d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2018-04',
          status: 'PENDING',
        },
        {
          priority: 4,
          action:
            'Shift $8M of 5-year auto loan production to 2-year variable to close the −0.6yr repricing gap.',
          actionEs:
            'Mover $8M de producción de préstamos auto a 5 años a 2 años variable para cerrar la brecha de repreciación de −0.6yr.',
          expectedImpact: '+6bps NIM (+$240K annualized); gap to −0.2yr',
          deadline: '60d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2021-02',
          status: 'PENDING',
        },
        {
          priority: 5,
          action:
            'Subscribe to monthly peer-benchmark EWS feed; alert when composite < 70 for 2 consecutive months.',
          actionEs:
            'Suscribirse al feed mensual de EWS de pares; alerta cuando compuesto < 70 por 2 meses consecutivos.',
          expectedImpact:
            'Continuous-monitoring contract; +60d lead time on next amber dip',
          deadline: '30d',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'NCUA Letter 24-CU-02',
          status: 'PENDING',
        },
      ],
      brief:
        'The institution is in the EWS amber zone (65/100, threshold 60). No single metric is critical, but three leading indicators are flashing together — delinquency trend, deposit erosion, NIM compression — for a combined trajectory worth $1.8M annualized. The recommended package surfaces this to the board, lifts CECL coverage to peer median, launches member retention, and closes the repricing gap. Pre-crisis cost of action is roughly 15% of the trajectory damage.',
      briefEs:
        'La institución está en zona amarilla del EWS (65/100, umbral 60). Ninguna métrica es crítica por sí sola, pero tres indicadores principales parpadean juntos — tendencia de morosidad, erosión de depósitos, compresión NIM — con una trayectoria combinada de $1.8M anualizados. El paquete recomendado lo eleva a la junta, sube la cobertura CECL a la mediana de pares, lanza retención de socios y cierra la brecha de repreciación. El costo pre-crisis de actuar es ~15% del daño de trayectoria.',
      auditTraceId: 'eval-trace-007',
    }),
    { inputTokens: 6400, outputTokens: 2100 },
  )

  .build();
