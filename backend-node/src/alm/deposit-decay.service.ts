import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Deposit Decay / Non-Maturity Deposit (NMD) Runoff Service — Quant Model #42
 *
 * Models the behavioral maturity of deposits that have no contractual maturity:
 * - Regular savings, checking, money market accounts
 * - Member share accounts (cooperativa-specific)
 *
 * Uses exponential decay model: Balance(t) = Balance(0) × e^(-λt)
 * Where λ = decay rate (calibrated from historical outflow data)
 *
 * Critical for:
 * - EVE calculations (behavioral duration of liabilities)
 * - NSFR ASF factor determination
 * - Liquidity risk assessment
 * - COSSEC examination: "How long do your deposits actually stay?"
 */

export interface DepositDecayResult {
  products: Array<{
    name: string;
    nameEs: string;
    balance: number;
    decayRate: number; // annual λ
    halfLife: number; // years
    behavioralMaturity: number; // years (weighted average life)
    survivalCurve: Array<{
      year: number;
      pctRemaining: number;
      balance: number;
    }>;
  }>;
  portfolioWeightedLife: number; // years
  portfolioHalfLife: number;
  totalNMDBalance: number;
  stableCorePct: number; // % of deposits classified as "core" (stable >1yr)
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class DepositDecayService {
  private readonly logger = new Logger(DepositDecayService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeDecay(_institutionId: string): Promise<DepositDecayResult> {
    return this.getDemoDecay();
  }

  private getDemoDecay(): DepositDecayResult {
    const products = [
      this.modelProduct(
        'Regular Savings',
        'Ahorro Regular',
        4_200_000_000,
        0.08,
      ),
      this.modelProduct(
        'Share Accounts',
        'Cuentas de Acciones',
        5_800_000_000,
        0.06,
      ),
      this.modelProduct(
        'Money Market',
        'Mercado Monetario',
        2_100_000_000,
        0.15,
      ),
      this.modelProduct(
        'Checking/Draft',
        'Cuenta Corriente',
        1_400_000_000,
        0.22,
      ),
      this.modelProduct('Club Accounts', 'Cuentas Club', 350_000_000, 0.12),
    ];

    const totalBalance = products.reduce((s, p) => s + p.balance, 0);
    const portfolioWeightedLife =
      products.reduce((s, p) => s + p.balance * p.behavioralMaturity, 0) /
      totalBalance;
    const portfolioHalfLife =
      products.reduce((s, p) => s + p.balance * p.halfLife, 0) / totalBalance;

    // Core deposits = those with behavioral maturity > 1 year
    const coreBalance = products
      .filter((p) => p.behavioralMaturity > 1)
      .reduce((s, p) => s + p.balance, 0);
    const stableCorePct = (coreBalance / totalBalance) * 100;

    return {
      products,
      portfolioWeightedLife: +portfolioWeightedLife.toFixed(2),
      portfolioHalfLife: +portfolioHalfLife.toFixed(2),
      totalNMDBalance: totalBalance,
      stableCorePct: +stableCorePct.toFixed(1),
      interpretation: `Portfolio weighted average life: ${portfolioWeightedLife.toFixed(1)} years. ${stableCorePct.toFixed(0)}% of NMD balances are classified as core (>1yr behavioral maturity). This supports the NSFR ASF factor of 0.90-0.95 for stable deposits.`,
      interpretationEs: `Vida promedio ponderada del portafolio: ${portfolioWeightedLife.toFixed(1)} anos. ${stableCorePct.toFixed(0)}% de saldos NMD se clasifican como fundamentales (>1 ano de madurez conductual). Esto respalda el factor ASF NSFR de 0.90-0.95 para depositos estables.`,
    };
  }

  private modelProduct(
    name: string,
    nameEs: string,
    balance: number,
    decayRate: number,
  ) {
    const halfLife = Math.log(2) / decayRate;
    const behavioralMaturity = 1 / decayRate; // WAL for exponential decay
    const survivalCurve: Array<{
      year: number;
      pctRemaining: number;
      balance: number;
    }> = [];

    for (let y = 0; y <= 10; y++) {
      const pct = Math.exp(-decayRate * y) * 100;
      survivalCurve.push({
        year: y,
        pctRemaining: +pct.toFixed(1),
        balance: +((balance * pct) / 100),
      });
    }

    return {
      name,
      nameEs,
      balance,
      decayRate,
      halfLife: +halfLife.toFixed(2),
      behavioralMaturity: +behavioralMaturity.toFixed(2),
      survivalCurve,
    };
  }
}
