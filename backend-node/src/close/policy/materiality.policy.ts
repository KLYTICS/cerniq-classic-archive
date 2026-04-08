/**
 * Materiality policy for the Close Cockpit.
 *
 * Materiality is the threshold at which a variance becomes worth a human's
 * attention during month-end close. Below the threshold the cockpit silences
 * the noise; above the threshold it demands a written explanation that ends
 * up in the audit binder.
 *
 * THIS IS A CFO/CPA JUDGMENT CALL. There is no single right answer. The
 * conservative defaults below are placeholders — the user is expected to
 * tune them to match the org's actual risk appetite and audit standards.
 *
 * Common policies in practice:
 *   - Fixed dollar:        "anything > $5,000 is material"
 *   - Percent of revenue:  "anything > 0.5% of TTM revenue"
 *   - Dual-trigger (SAS):  "absolute > $X AND percent > Y%"  ← strictest
 *   - Tiered by account:   cash and revenue 0.25%, opex 1%, etc.
 *
 * The output of `evaluate()` is what gets frozen onto the CloseCycle row at
 * cycle-creation time, so changing this policy never retroactively changes
 * a closed period — auditors love that.
 */

export interface MaterialityInputs {
  /** Trailing-twelve-month revenue for the org, in USD. */
  ttmRevenue: number;
  /** Total assets at the close date, in USD. */
  totalAssets: number;
  /** Optional account being scored — lets you tier by account class. */
  account?: string;
}

export interface MaterialityResult {
  /** Absolute dollar threshold; variances ≥ this trip "material". */
  thresholdAbs: number;
  /** Percent threshold (e.g. 0.005 for 0.5%); variances ≥ this also trip. */
  thresholdPct: number;
  /** Free-text rationale that gets written into the audit binder. */
  rationaleEn: string;
  rationaleEs: string;
}

/**
 * Active policy: SAS-style dual-trigger.
 *
 * A variance is material only when BOTH the dollar threshold and the percent
 * threshold trip. This is the convention most CPA firms use because it
 * filters out two kinds of noise that would otherwise drown the controller:
 *
 *   1. Small-dollar high-percent swings (e.g. $50 → $200 in a tiny prepaid
 *      account is 300% but $150 is not worth a human's time).
 *   2. Large-dollar low-percent drift (e.g. a $6K bump on $600K of loan
 *      income is only 1% — likely just normal volume noise).
 *
 * Dollar floor: greater of $5,000 OR 0.5% of TTM revenue. The $5K floor
 * exists so the policy still bites for tiny new orgs whose 0.5% is trivially
 * small. The 0.5% scales the threshold up as the cooperativa grows so the
 * cockpit doesn't drown the CFO in alerts at $10M ARR.
 *
 * Percent floor: 5% line-item variance.
 */
export function evaluateMateriality(
  inputs: MaterialityInputs,
): MaterialityResult {
  const thresholdAbs = Math.max(5_000, inputs.ttmRevenue * 0.005);
  const thresholdPct = 0.05;

  return {
    thresholdAbs,
    thresholdPct,
    rationaleEn:
      'SAS-style dual-trigger: greater of $5,000 or 0.5% of TTM revenue, AND ≥5% line variance.',
    rationaleEs:
      'Doble umbral estilo SAS: el mayor entre $5,000 o 0.5% de ingresos TTM, Y variación de línea ≥5%.',
  };
}

/**
 * Pure helper used by the flux narrator. A variance is material when BOTH
 * triggers fire — dual-trigger is the standard CPA-firm convention because
 * it filters out small-dollar high-percent noise (e.g. a $50 → $200 swing
 * in a tiny prepaid account is 300% but not worth a human's time).
 *
 * Tweak the AND to an OR if your org uses a single-trigger policy.
 */
export function isMaterial(
  varianceAbs: number,
  variancePct: number,
  policy: MaterialityResult,
): boolean {
  return (
    Math.abs(varianceAbs) >= policy.thresholdAbs &&
    Math.abs(variancePct) >= policy.thresholdPct
  );
}
