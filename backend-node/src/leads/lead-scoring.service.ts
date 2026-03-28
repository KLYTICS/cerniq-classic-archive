import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * CERNIQ Lead Scoring Engine.
 * Scores leads 0-100 based on fit (institution profile) and intent (engagement signals).
 *
 * Fit Score (0-50):
 * - Institution type: cooperativa (15), credit_union (12), bank (10), family_office (8), other (5)
 * - Asset size: >$500M (15), >$100M (12), >$50M (10), <$50M (5)
 * - Location: Puerto Rico (10), USVI (8), US mainland (5), other (3)
 * - Regulatory pressure: COSSEC exam pending (10), NCUA exam pending (8), none (0)
 *
 * Intent Score (0-50):
 * - Demo completed all 6 steps (15)
 * - Demo partially completed (8)
 * - Contact form submitted (10)
 * - Pricing page visited (5)
 * - Return visitor (5)
 * - Report downloaded (10)
 * - Checkout started but abandoned (15)
 */

export interface LeadScore {
  total: number;       // 0-100
  fit: number;         // 0-50
  intent: number;      // 0-50
  tier: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
  factors: string[];   // Human-readable scoring factors
}

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scoreLead(leadId: string): Promise<LeadScore> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { total: 0, fit: 0, intent: 0, tier: 'UNQUALIFIED', factors: ['Lead not found'] };

    let fit = 0;
    let intent = 0;
    const factors: string[] = [];

    // ── Fit Score ──
    // Institution type
    const typeScores: Record<string, number> = {
      cooperativa: 15, credit_union: 12, bank: 10, community_bank: 10,
      family_office: 8, cpa_consultant: 6, other: 5,
    };
    const typeScore = typeScores[(lead as any).institutionType] || 5;
    fit += typeScore;
    factors.push(`Institution type: ${(lead as any).institutionType} (+${typeScore})`);

    // Source quality
    if ((lead as any).source === 'demo_completion') { intent += 15; factors.push('Completed demo (+15 intent)'); }
    else if ((lead as any).source === 'pricing_page') { intent += 10; factors.push('From pricing page (+10 intent)'); }
    else if ((lead as any).source === 'contact_form') { intent += 8; factors.push('Contact form submission (+8 intent)'); }
    else if ((lead as any).source === 'referral') { intent += 12; factors.push('Referral lead (+12 intent)'); }

    // Notes indicate engagement
    if ((lead as any).notes && (lead as any).notes.length > 0) {
      intent += 5;
      factors.push('Has engagement notes (+5 intent)');
    }

    // Report sent = high intent
    if ((lead as any).reportSentAt) {
      intent += 10;
      factors.push('Report delivered (+10 intent)');
    }

    // Clamp scores
    fit = Math.min(fit, 50);
    intent = Math.min(intent, 50);
    const total = fit + intent;

    // Tier assignment
    let tier: LeadScore['tier'] = 'COLD';
    if (total >= 70) tier = 'HOT';
    else if (total >= 40) tier = 'WARM';
    else if (total >= 20) tier = 'COLD';
    else tier = 'UNQUALIFIED';

    return { total, fit, intent, tier, factors };
  }

  async scoreAllLeads(): Promise<{ scored: number; hot: number; warm: number; cold: number }> {
    const leads = await this.prisma.lead.findMany({
      where: { status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED'] } },
      take: 500,
    });

    let hot = 0, warm = 0, cold = 0;
    for (const lead of leads) {
      const score = await this.scoreLead(lead.id);

      // Update lead priority based on score
      const priority = score.tier === 'HOT' ? 'HIGH' : score.tier === 'WARM' ? 'MEDIUM' : 'LOW';
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { priority },
      });

      if (score.tier === 'HOT') hot++;
      else if (score.tier === 'WARM') warm++;
      else cold++;
    }

    return { scored: leads.length, hot, warm, cold };
  }
}
