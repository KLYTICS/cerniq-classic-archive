import { Injectable, Logger } from '@nestjs/common';
import { MemberAccountCategory } from '@prisma/client';

/**
 * Deterministic fixture data for the Member 360 demo surface.
 *
 * Wave 3 / Layer 3 (docs/CERNIQ_LAYER2_3_ROADMAP.md §4) is gated on a still-
 * open discovery question — can a real cooperativa's core system export
 * member-level data, and will its board consent to sharing socio PII. No
 * design partner is confirmed as of this slice, so this service produces a
 * realistic, bilingual, PR-cooperativa-shaped member book that lets every
 * other Member 360 surface (lifecycle classification, the 360 profile view,
 * the directory) be demoed and tested end-to-end today. Swapping this for a
 * real core-system adapter later changes nothing downstream — it is the same
 * MemberSeed[] shape either way.
 *
 * Seeded, not random: `verify:no-unseeded-random` bans bare `Math.random()`
 * in src/alm because a fixture that changes on every call cannot be demoed
 * reproducibly or golden-locked. `mulberry32` seeded from
 * `institutionId:index` makes the SAME institution produce the SAME member
 * book every time, and different institutions produce different books.
 */

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Common PR-cooperativa first/last names — bilingual, plausible, not real people. */
const FIRST_NAMES = [
  'María',
  'José',
  'Carmen',
  'Luis',
  'Ana',
  'Juan',
  'Rosa',
  'Carlos',
  'Elena',
  'Miguel',
  'Sofía',
  'Rafael',
  'Gabriela',
  'Ángel',
  'Ivelisse',
  'Pedro',
  'Yolanda',
  'Francisco',
  'Nilda',
  'Héctor',
  'Awilda',
  'Ramón',
  'Migdalia',
  'Eduardo',
  'Wanda',
  'Antonio',
  'Zoraida',
  'Manuel',
  'Lourdes',
  'Iván',
] as const;

const LAST_NAMES = [
  'Rodríguez',
  'González',
  'Rivera',
  'Martínez',
  'Torres',
  'Ortiz',
  'Vázquez',
  'Rosario',
  'Santiago',
  'Colón',
  'Feliciano',
  'Cruz',
  'Morales',
  'Reyes',
  'Class',
  'Meléndez',
  'Ramos',
  'Díaz',
  'Pérez',
  'Figueroa',
] as const;

/** Mirrors cooperativa/product-registry.ts's 8-product taxonomy by label. */
interface ProductTemplate {
  productType: string;
  category: MemberAccountCategory;
  balanceRangeUSD: [number, number];
  /** Annual rate as a decimal (0.065 = 6.5%). Null for SHARE (no stated rate). */
  rateRange: [number, number] | null;
  /** Fraction of members who hold this product, independent per product. */
  incidence: number;
  isLoan: boolean;
}

const PRODUCT_TEMPLATES: readonly ProductTemplate[] = [
  {
    productType: 'acciones',
    category: MemberAccountCategory.SHARE,
    balanceRangeUSD: [25, 500],
    rateRange: null,
    incidence: 1.0,
    isLoan: false,
  },
  {
    productType: 'cuenta de ahorros',
    category: MemberAccountCategory.DEPOSIT,
    balanceRangeUSD: [200, 45000],
    rateRange: [0.001, 0.015],
    incidence: 0.86,
    isLoan: false,
  },
  {
    productType: 'certificado de depósito',
    category: MemberAccountCategory.DEPOSIT,
    balanceRangeUSD: [1000, 60000],
    rateRange: [0.02, 0.045],
    incidence: 0.17,
    isLoan: false,
  },
  {
    productType: 'préstamo personal',
    category: MemberAccountCategory.LOAN,
    balanceRangeUSD: [800, 15000],
    rateRange: [0.09, 0.16],
    incidence: 0.28,
    isLoan: true,
  },
  {
    productType: 'préstamo de auto',
    category: MemberAccountCategory.LOAN,
    balanceRangeUSD: [4000, 32000],
    rateRange: [0.055, 0.09],
    incidence: 0.19,
    isLoan: true,
  },
  {
    productType: 'hipoteca',
    category: MemberAccountCategory.LOAN,
    balanceRangeUSD: [45000, 260000],
    rateRange: [0.045, 0.07],
    incidence: 0.06,
    isLoan: true,
  },
  {
    productType: 'préstamo comercial',
    category: MemberAccountCategory.LOAN,
    balanceRangeUSD: [15000, 180000],
    rateRange: [0.065, 0.11],
    incidence: 0.03,
    isLoan: true,
  },
  {
    productType: 'garantía de acciones',
    category: MemberAccountCategory.LOAN,
    balanceRangeUSD: [500, 8000],
    rateRange: [0.06, 0.085],
    incidence: 0.08,
    isLoan: true,
  },
];

/** Delinquency distribution for accounts flagged `isLoan` — cumulative bands. */
const DELINQUENCY_BANDS: readonly { maxDays: number; upTo: number }[] = [
  { maxDays: 0, upTo: 0.8 }, // current
  { maxDays: 29, upTo: 0.9 },
  { maxDays: 59, upTo: 0.96 },
  { maxDays: 89, upTo: 0.99 },
  { maxDays: 150, upTo: 1.0 },
];

export interface MemberAccountSeed {
  productType: string;
  category: MemberAccountCategory;
  balance: number;
  interestRate: number | null;
  delinquencyDays: number | null;
  maturityDate: Date | null;
  openedDate: Date;
  /** Derived from delinquencyDays at generation time — see classifyCossec(). */
  cossecClassification: string | null;
}

export interface MemberSeed {
  memberNumber: string;
  fullName: string;
  memberSince: Date;
  accounts: MemberAccountSeed[];
}

/** COSSEC NPL staging derived from a KNOWN delinquency value. Only ever
 * called with a real, generated DPD — never used to backfill an unknown one
 * (that path lives in MemberLifecycleService and stays null on purpose). */
function classifyCossec(delinquencyDays: number): string {
  if (delinquencyDays === 0) return 'pass';
  if (delinquencyDays <= 29) return 'special_mention';
  if (delinquencyDays <= 59) return 'substandard';
  if (delinquencyDays <= 89) return 'doubtful';
  return 'loss';
}

function pickDelinquencyDays(rng: () => number): number {
  const roll = rng();
  for (const band of DELINQUENCY_BANDS) {
    if (roll <= band.upTo) {
      if (band.maxDays === 0) return 0;
      const prevMax =
        DELINQUENCY_BANDS[DELINQUENCY_BANDS.indexOf(band) - 1]?.maxDays ?? 0;
      return prevMax + 1 + Math.floor(rng() * (band.maxDays - prevMax));
    }
  }
  return 0;
}

function randomInRange(
  rng: () => number,
  [min, max]: [number, number],
): number {
  return min + rng() * (max - min);
}

function randomPastDate(
  rng: () => number,
  maxYearsAgo: number,
  minDaysAgo: number,
  asOfMs: number,
): Date {
  const msAgo =
    minDaysAgo * 86_400_000 +
    rng() * (maxYearsAgo * 365 * 86_400_000 - minDaysAgo * 86_400_000);
  return new Date(asOfMs - msAgo);
}

@Injectable()
export class MemberFixtureService {
  private readonly logger = new Logger(MemberFixtureService.name);

  /**
   * Generate `count` deterministic members for `institutionId`. Same
   * (institutionId, count) always produces the same book — the fixture is
   * reproducible, not merely plausible-looking.
   */
  generateMembers(institutionId: string, count = 50): MemberSeed[] {
    // Truncated to the UTC day boundary, not a raw Date.now(): a fixture
    // documented as "deterministic, not merely plausible-looking" cannot
    // anchor its date math to millisecond-resolution wall-clock time — two
    // calls a millisecond apart produced byte-different output even with
    // asOfMs frozen once per call (each call still sampled a different
    // instant). Day-granularity keeps repeated same-day calls byte-
    // identical while still advancing daily so demo data doesn't go stale.
    const asOfMs = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    const members: MemberSeed[] = [];
    for (let i = 0; i < count; i++) {
      const rng = mulberry32(hashStringToSeed(`${institutionId}:member:${i}`));
      const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const last1 = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      const last2 = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      const memberSince = randomPastDate(rng, 15, 1, asOfMs);

      const accounts: MemberAccountSeed[] = [];
      for (const template of PRODUCT_TEMPLATES) {
        if (rng() > template.incidence) continue;

        const balance = Number(
          randomInRange(rng, template.balanceRangeUSD).toFixed(2),
        );
        const interestRate = template.rateRange
          ? Number(randomInRange(rng, template.rateRange).toFixed(6))
          : null;
        const openedDate = randomPastDate(
          rng,
          Math.max(1, (asOfMs - memberSince.getTime()) / (365 * 86_400_000)),
          1,
          asOfMs,
        );

        let delinquencyDays: number | null = null;
        let cossecClassification: string | null = null;
        let maturityDate: Date | null = null;

        if (template.isLoan) {
          delinquencyDays = pickDelinquencyDays(rng);
          cossecClassification = classifyCossec(delinquencyDays);
          const termYears = template.productType === 'hipoteca' ? 20 : 5;
          maturityDate = new Date(
            openedDate.getTime() + termYears * 365 * 86_400_000,
          );
        } else if (template.productType === 'certificado de depósito') {
          // CDs carry a maturity even though they're not loans — the
          // upcoming-maturity next-best-action depends on this.
          const termMonths = [6, 12, 18, 24][Math.floor(rng() * 4)];
          maturityDate = new Date(
            openedDate.getTime() + termMonths * 30 * 86_400_000,
          );
        }

        accounts.push({
          productType: template.productType,
          category: template.category,
          balance,
          interestRate,
          delinquencyDays,
          maturityDate,
          openedDate,
          cossecClassification,
        });
      }

      members.push({
        memberNumber: `M-${(10000 + i).toString()}`,
        fullName: `${first} ${last1} ${last2}`,
        memberSince,
        accounts,
      });
    }

    this.logger.log(
      `Generated ${members.length} fixture members for institution ${institutionId}`,
    );
    return members;
  }
}
