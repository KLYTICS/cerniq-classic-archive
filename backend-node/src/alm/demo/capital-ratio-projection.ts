/**
 * Capital-ratio-under-stress projection (seeded, reproducible).
 *
 * Given a deterministic stress result from the ALM engine (credit loss, deposit
 * funding cost, NII shortfall) this produces a DISTRIBUTION of stressed capital
 * ratios by drawing seeded severity multipliers around each deterministic loss.
 *
 * Design contract:
 *  - The DETERMINISTIC point (no severity) equals the engine's own stressed
 *    capital ratio exactly — the projection never invents the central estimate,
 *    it only widens it into a band.
 *  - Seeded (xorshift32 + Box–Muller, FNV-1a-keyed) ⇒ identical inputs produce
 *    identical output (SR 11-7). No `Math.random` / `crypto.randomBytes`.
 *  - The severity coefficients of variation are DISCLOSED model assumptions
 *    (not empirically calibrated); they are echoed in `disclosures[]` so a
 *    reviewer sees exactly what shaped the band.
 *
 * This is a parametric stress band for communication, anchored to real,
 * engine-computed losses — not a fabricated number.
 */

export interface CapitalRatioProjectionInput {
  /** Net worth / equity before stress, $M. */
  baseEquity: number;
  /** Total assets, $M (the capital-ratio denominator). */
  totalAssets: number;
  /** COSSEC statutory minimum capital ratio, percent (e.g. 7). */
  cossecMinimumPct: number;
  /** Deterministic stress losses from the engine, all $M, all ≥ 0. */
  deterministicLosses: {
    /** Incremental credit loss (segment-targeted). */
    creditLoss: number;
    /** Incremental funding cost from deposit runoff. */
    depositCost: number;
    /** Lost net interest income vs baseline (earnings that would have built capital). */
    niiShortfall: number;
  };
  /** Deterministic seed string ⇒ reproducible draws. */
  seed: string;
  /** Monte Carlo paths (clamped to [200, 100000]). Default 5000. */
  paths?: number;
  /**
   * Disclosed severity coefficients of variation (stddev / mean) applied to
   * each deterministic loss. Defaults are conservative communication assumptions.
   */
  assumptions?: {
    creditSeverityCv?: number;
    depositSeverityCv?: number;
    niiSeverityCv?: number;
  };
}

export interface CapitalRatioPercentiles {
  /** Adverse tail — 5th percentile of the capital-ratio distribution. */
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  /** Benign tail — 95th percentile. */
  p95: number;
}

export interface CapitalRatioUnderStress {
  baselineCapitalRatioPct: number;
  deterministic: {
    creditLoss: number;
    depositCost: number;
    niiShortfall: number;
    totalLoss: number;
    stressedEquity: number;
    stressedCapitalRatioPct: number;
  };
  /** Percentiles of the stressed capital ratio (p5 = adverse). */
  distribution: CapitalRatioPercentiles;
  meanCapitalRatioPct: number;
  /** Share of paths whose stressed capital ratio falls below the COSSEC minimum. */
  breachProbabilityPct: number;
  /** Adverse-tail (p5) cushion above the COSSEC minimum, in basis points. */
  adverseCushionBps: number;
  /** True when the adverse-tail (p5) capital ratio is below the COSSEC minimum. */
  breachesFloorAtAdverseTail: boolean;
  paths: number;
  seed: string;
  assumptions: {
    creditSeverityCv: number;
    depositSeverityCv: number;
    niiSeverityCv: number;
  };
  disclosures: string[];
}

const DEFAULT_ASSUMPTIONS = {
  creditSeverityCv: 0.4,
  depositSeverityCv: 0.3,
  niiSeverityCv: 0.35,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** FNV-1a 32-bit hash of a string → uint32 seed. */
function fnv1a(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** xorshift32 PRNG returning a uniform in (0, 1). */
function makeUniform(seedUint32: number): () => number {
  let state = seedUint32 || 0x9e3779b9; // avoid the zero fixed-point
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    // map to (0,1): keep both endpoints open for Box–Muller log()
    return (state + 0.5) / 0x100000000;
  };
}

/** Standard-normal draw via Box–Muller from a uniform stream. */
function makeNormal(uniform: () => number): () => number {
  return () => {
    const u1 = uniform();
    const u2 = uniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(q * sorted.length)),
  );
  return sorted[idx];
}

/**
 * Project the stressed capital-ratio distribution. Deterministic given
 * `input.seed`; the central estimate equals the engine's stressed ratio.
 */
export function projectCapitalRatioUnderStress(
  input: CapitalRatioProjectionInput,
): CapitalRatioUnderStress {
  const paths = Math.min(
    Math.max(Math.floor(input.paths ?? 5000), 200),
    100000,
  );
  const a = { ...DEFAULT_ASSUMPTIONS, ...(input.assumptions ?? {}) };
  const { baseEquity, totalAssets, cossecMinimumPct } = input;
  const { creditLoss, depositCost, niiShortfall } = input.deterministicLosses;

  const baselineCapitalRatioPct =
    totalAssets > 0 ? (baseEquity / totalAssets) * 100 : 0;

  // Deterministic central estimate (no severity) — matches the engine.
  const totalLoss = creditLoss + depositCost + niiShortfall;
  const stressedEquity = baseEquity - totalLoss;
  const stressedCapitalRatioPct =
    totalAssets > 0 ? (stressedEquity / totalAssets) * 100 : 0;

  const normal = makeNormal(makeUniform(fnv1a(input.seed)));

  // A severity multiplier ~ max(0, 1 + cv·Z): mean ~1 so the distribution is
  // centred on the deterministic losses; floored at 0 (a loss can't be negative).
  const severity = (cv: number) => Math.max(0, 1 + cv * normal());

  const ratios: number[] = [];
  let breaches = 0;
  for (let i = 0; i < paths; i++) {
    const pathLoss =
      creditLoss * severity(a.creditSeverityCv) +
      depositCost * severity(a.depositSeverityCv) +
      niiShortfall * severity(a.niiSeverityCv);
    const ratio =
      totalAssets > 0 ? ((baseEquity - pathLoss) / totalAssets) * 100 : 0;
    ratios.push(ratio);
    if (ratio < cossecMinimumPct) breaches++;
  }
  ratios.sort((x, y) => x - y);

  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const p5 = percentile(ratios, 0.05);

  const disclosures = [
    'Parametric stress band: each deterministic loss is scaled by an independent severity multiplier max(0, 1 + CV·Z), Z ~ N(0,1).',
    `Severity CVs are disclosed model assumptions (credit ${a.creditSeverityCv}, deposit ${a.depositSeverityCv}, NII ${a.niiSeverityCv}), not empirically calibrated.`,
    'The central (deterministic) stressed capital ratio is the ALM engine output; the band only expresses uncertainty around it.',
    `Seeded (seed="${input.seed}") — identical inputs reproduce this distribution exactly (SR 11-7).`,
  ];

  return {
    baselineCapitalRatioPct: round2(baselineCapitalRatioPct),
    deterministic: {
      creditLoss: round2(creditLoss),
      depositCost: round2(depositCost),
      niiShortfall: round2(niiShortfall),
      totalLoss: round2(totalLoss),
      stressedEquity: round2(stressedEquity),
      stressedCapitalRatioPct: round2(stressedCapitalRatioPct),
    },
    distribution: {
      p5: round2(p5),
      p25: round2(percentile(ratios, 0.25)),
      p50: round2(percentile(ratios, 0.5)),
      p75: round2(percentile(ratios, 0.75)),
      p95: round2(percentile(ratios, 0.95)),
    },
    meanCapitalRatioPct: round2(mean),
    breachProbabilityPct: round2((breaches / paths) * 100),
    adverseCushionBps: Math.round((p5 - cossecMinimumPct) * 100),
    breachesFloorAtAdverseTail: p5 < cossecMinimumPct,
    paths,
    seed: input.seed,
    assumptions: a,
    disclosures,
  };
}
