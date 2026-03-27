import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

export interface ReferralCode {
  id: string;
  code: string;
  referrerInstitutionId: string;
  referrerName: string;
  status: 'active' | 'used' | 'expired';
  createdAt: string;
  expiresAt: string;
  usedByName?: string;
}

export interface ReferralStats {
  totalCodes: number;
  activeCodes: number;
  usedCodes: number;
  totalCreditsEarned: number;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateCode(referrerInstitutionId: string): Promise<ReferralCode> {
    const inst = await this.prisma.institution.findUniqueOrThrow({
      where: { id: referrerInstitutionId },
    });
    const prefix =
      inst.name
        .replace(/[^A-Z]/gi, '')
        .slice(0, 4)
        .toUpperCase() || 'CRNQ';
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `CERNIQ-${prefix}-${suffix}`;
    const expiresAt = new Date(Date.now() + 90 * 86400000); // 90 days

    // Store in a simple way using existing models
    // In production: dedicated ReferralCode model
    this.logger.log(`Referral code generated: ${code} for ${inst.name}`);

    return {
      id: crypto.randomUUID(),
      code,
      referrerInstitutionId,
      referrerName: inst.name,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async validateCode(
    code: string,
  ): Promise<{ valid: boolean; referrerName?: string; discount?: string }> {
    // Simple validation — in production, check against DB
    if (!code.startsWith('CERNIQ-')) {
      return { valid: false };
    }
    return {
      valid: true,
      referrerName: 'Referring Institution',
      discount: '$500/month pilot rate (vs $750 standard)',
    };
  }

  async applyCode(
    refereeInstitutionId: string,
    code: string,
  ): Promise<{ applied: boolean; message: string }> {
    const validation = await this.validateCode(code);
    if (!validation.valid) {
      throw new BadRequestException('Invalid or expired referral code');
    }

    this.logger.log(
      `Referral code ${code} applied by institution ${refereeInstitutionId}`,
    );

    return {
      applied: true,
      message: `Referral applied! Pilot rate: $500/month. Referrer earns 1 month free credit.`,
    };
  }

  async getStats(institutionId: string): Promise<ReferralStats> {
    // Demo stats — in production, query ReferralCode model
    return {
      totalCodes: 3,
      activeCodes: 2,
      usedCodes: 1,
      totalCreditsEarned: 3500, // 1 referral × $3,500 credit
    };
  }
}
