import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { computePromptVersion } from '../../alm/analyst/prompt-version';
import { extractUsage, estimateCostCents } from '../../alm/analyst/llm-usage';

export interface RegulatoryImpact {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  requirements: string[];
  affectedSubcategories: string[];
  deadline: string | null;
  keyQuote: string | null;
}

// KLYTICS Rule 9 anchor — single source of truth for the model id used in
// both the SDK call and the cost / prompt-fingerprint stamp.
const IMPACT_EXTRACTOR_MODEL = 'claude-sonnet-4-20250514';
const IMPACT_EXTRACTOR_SYSTEM_PROMPT =
  'Eres un experto en regulación financiera de Puerto Rico. Responde SOLO con JSON válido.';

@Injectable()
export class ImpactExtractorService {
  private readonly logger = new Logger(ImpactExtractorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async extract(publicationId: string): Promise<RegulatoryImpact> {
    const pub = await this.prisma.regulatoryPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });

    // Try Claude API if available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic();
        // KLYTICS Rule 9: fingerprint (model, systemPrompt) once before the
        // call so the audit trail correlates the impact-extraction result
        // with the exact prompt + model bundle.
        const promptVersion = computePromptVersion({
          model: IMPACT_EXTRACTOR_MODEL,
          systemPrompt: IMPACT_EXTRACTOR_SYSTEM_PROMPT,
        });
        const startMs = Date.now();
        const response = await client.messages.create({
          model: IMPACT_EXTRACTOR_MODEL,
          max_tokens: 800,
          system: IMPACT_EXTRACTOR_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analiza esta regulación de ${pub.regulator}: "${pub.title}"\nTexto: ${pub.rawText.slice(0, 15000)}\n\nJSON schema: { "severity":"HIGH"|"MEDIUM"|"LOW", "requirements":string[], "affectedSubcategories":string[], "deadline":string|null, "keyQuote":string }`,
            },
          ],
        });
        // KLYTICS Rule 9: emit cost + usage stamp. Rule 1 compounds —
        // null usage or unknown model → costCents:null with reason.
        const usage = extractUsage(response);
        const costEstimate = usage
          ? estimateCostCents(IMPACT_EXTRACTOR_MODEL, usage)
          : null;
        this.logger.log({
          event: 'rule-9-stamp',
          surface: 'impact-extractor.extract',
          publicationId,
          model: IMPACT_EXTRACTOR_MODEL,
          promptVersion,
          usage,
          costCents: costEstimate?.cents ?? null,
          latencyMs: Date.now() - startMs,
          ...(costEstimate && 'pricingVersion' in costEstimate
            ? { pricingVersion: costEstimate.pricingVersion }
            : {
                costMissingReason:
                  costEstimate && 'reason' in costEstimate
                    ? costEstimate.reason
                    : null,
              }),
        });
        const json = JSON.parse(
          response.content[0].type === 'text' ? response.content[0].text : '{}',
        );
        const impact: RegulatoryImpact = {
          severity: json.severity ?? 'MEDIUM',
          requirements: json.requirements ?? [],
          affectedSubcategories: json.affectedSubcategories ?? [],
          deadline: json.deadline ?? null,
          keyQuote: json.keyQuote ?? pub.title,
        };
        await this.prisma.regulatoryPublication.update({
          where: { id: publicationId },
          data: { impactJson: impact as any, processedAt: new Date() },
        });
        return impact;
      } catch (e: any) {
        this.logger.warn(`Claude extraction failed: ${e.message}`);
      }
    }

    // Heuristic fallback
    const impact = this.heuristicExtract(pub);
    await this.prisma.regulatoryPublication.update({
      where: { id: publicationId },
      data: { impactJson: impact as any, processedAt: new Date() },
    });
    return impact;
  }

  private heuristicExtract(pub: any): RegulatoryImpact {
    const text = (pub.rawText ?? pub.title ?? '').toLowerCase();
    const affectedSubcategories: string[] = [];
    if (
      text.includes('liquidez') ||
      text.includes('lcr') ||
      text.includes('liquidity')
    )
      affectedSubcategories.push('liquidity');
    if (
      text.includes('capital') ||
      text.includes('nwr') ||
      text.includes('net worth')
    )
      affectedSubcategories.push('capital');
    if (
      text.includes('tasa') ||
      text.includes('interés') ||
      text.includes('rate')
    )
      affectedSubcategories.push('interest_rate');
    if (
      text.includes('préstamo') ||
      text.includes('loan') ||
      text.includes('crédito')
    )
      affectedSubcategories.push('credit');
    if (text.includes('concentración') || text.includes('concentration'))
      affectedSubcategories.push('concentration');

    const severity =
      text.includes('obligat') ||
      text.includes('mandatory') ||
      text.includes('inmediato')
        ? 'HIGH'
        : text.includes('recomend') || text.includes('guideline')
          ? 'LOW'
          : 'MEDIUM';

    return {
      severity,
      requirements: [`Review: ${pub.title}`],
      affectedSubcategories,
      deadline: null,
      keyQuote: pub.title,
    };
  }
}
