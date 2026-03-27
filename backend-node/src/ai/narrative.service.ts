import { Injectable, Logger } from '@nestjs/common';

// Auto-Narrative Engine: generates 3-sentence Spanish paragraph per metric
// Uses Haiku for cost efficiency (~$0.001 per narrative)

const NARRATIVE_PROMPTS: Record<string, string> = {
  nim: 'Analiza el margen de interés neto (NIM) de esta cooperativa.',
  lcr: 'Analiza el ratio de cobertura de liquidez (LCR).',
  nwr: 'Analiza el patrimonio neto al valor del activo (NWR).',
  camel: 'Analiza el puntaje compuesto CAMEL.',
  eve: 'Analiza la sensibilidad del valor económico del capital (EVE).',
  cecl: 'Analiza la provisión CECL para pérdidas crediticias.',
  concentration: 'Analiza el riesgo de concentración del portafolio.',
  climate: 'Analiza la exposición al riesgo climático por huracanes.',
};

const CITATIONS: Record<string, string> = {
  nim: 'COSSEC CC-2022-03 §3.2',
  lcr: 'COSSEC CC-2021-01 §4.1',
  nwr: 'NCUA 12 C.F.R. § 702',
  camel: 'COSSEC CAMEL 2019 §2.3',
  eve: 'NCUA 21-CU-04',
  cecl: 'OCIF CC-2020-02',
  concentration: 'OCIF CC-2018-01 §3',
  climate: 'FEMA NFIP PR',
};

// Cache narratives to avoid repeated AI calls
const narrativeCache = new Map<string, { text: string; expiresAt: number }>();

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  async generateNarrative(
    institutionName: string,
    metricName: string,
    value: number,
    peerMedian: number,
  ): Promise<string> {
    const cacheKey = `${metricName}:${Math.round(value * 100)}:${Math.round(peerMedian * 100)}`;
    const cached = narrativeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.text;

    const prompt =
      NARRATIVE_PROMPTS[metricName] ?? `Analiza la métrica ${metricName}.`;
    const citation = CITATIONS[metricName] ?? '';
    const compare = value >= peerMedian ? 'por encima' : 'por debajo';
    const deltaPct = Math.abs(
      ((value - peerMedian) / (peerMedian || 1)) * 100,
    ).toFixed(1);

    // Try Claude API
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic();
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system:
            'Eres el analista de riesgo de CERNIQ. Escribe exactamente 3 oraciones en español profesional financiero.',
          messages: [
            {
              role: 'user',
              content: `${prompt} Institución: ${institutionName}. Valor: ${value.toFixed(2)}. Mediana PR: ${peerMedian.toFixed(2)} (${deltaPct}% ${compare}). Ref: ${citation}. Estructura: (1) estado actual vs pares, (2) implicación, (3) acción sugerida.`,
            },
          ],
        });
        const text = (response.content[0] as any).text?.trim() ?? '';
        if (text) {
          narrativeCache.set(cacheKey, {
            text,
            expiresAt: Date.now() + 86400000,
          });
          return text;
        }
      } catch (e: any) {
        this.logger.warn(`Narrative generation failed: ${e.message}`);
      }
    }

    // Fallback: template-based narrative
    const template = `${institutionName} presenta un ${metricName.toUpperCase()} de ${value.toFixed(2)}, que se encuentra ${deltaPct}% ${compare} de la mediana de cooperativas PR de ${peerMedian.toFixed(2)}. ${value >= peerMedian ? 'Esta posición es favorable comparada con el sector.' : 'Se recomienda revisar estrategias para mejorar este indicador.'} Referencia: ${citation}.`;
    narrativeCache.set(cacheKey, {
      text: template,
      expiresAt: Date.now() + 86400000,
    });
    return template;
  }

  async generateDashboardNarratives(
    institutionName: string,
    metrics: Record<string, { value: number; peerMedian: number }>,
  ): Promise<Record<string, string>> {
    const entries = Object.entries(metrics);
    const results = await Promise.all(
      entries.map(([name, m]) =>
        this.generateNarrative(institutionName, name, m.value, m.peerMedian),
      ),
    );
    return Object.fromEntries(entries.map(([name], i) => [name, results[i]]));
  }
}
