import { Injectable, Logger } from '@nestjs/common';

// ─── Standard Rating Scale (Moody's / S&P equivalent) ────────

const STANDARD_RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'];

// ─── Moody's-Style 1-Year Transition Matrix (historical avg) ─
// Rows/Cols: AAA, AA, A, BBB, BB, B, CCC, D
// Source: Approximation of Moody's historical corporate bond defaults

const MOODYS_DEFAULT_MATRIX: number[][] = [
  // AAA ->
  [0.9081, 0.0833, 0.0068, 0.0006, 0.0012, 0.0, 0.0, 0.0],
  // AA ->
  [0.007, 0.9065, 0.0779, 0.0064, 0.0006, 0.0014, 0.0002, 0.0],
  // A ->
  [0.0009, 0.0227, 0.9105, 0.0552, 0.0074, 0.0026, 0.0001, 0.0006],
  // BBB ->
  [0.0002, 0.0033, 0.0595, 0.8693, 0.053, 0.0117, 0.0012, 0.0018],
  // BB ->
  [0.0003, 0.0014, 0.0067, 0.0773, 0.8053, 0.0884, 0.01, 0.0106],
  // B ->
  [0.0, 0.0011, 0.0024, 0.0043, 0.0648, 0.8346, 0.0407, 0.0521],
  // CCC ->
  [0.0022, 0.0, 0.0022, 0.013, 0.0238, 0.1124, 0.6486, 0.1978],
  // D -> (absorbing state)
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
];

// ─── Types ───────────────────────────────────────────────────

export interface HistoricalRating {
  entity: string;
  period: number;
  rating: string;
}

export interface TransitionMatrixResult {
  matrix: number[][];
  ratings: string[];
  sampleSize: number;
  periodCount: number;
}

export interface PortfolioPosition {
  rating: string;
  exposure: number;
}

export interface ProjectedPosition {
  rating: string;
  exposure: number;
  change: number;
  changePct: number;
}

export interface ProjectionResult {
  projected: ProjectedPosition[];
  expectedLoss: number;
  migrationRisk: number;
}

export interface DefaultProbabilityResult {
  cumulativePD: number;
  marginalPDs: number[];
  survivalProbability: number;
}

export interface StressedMatrixResult {
  stressedMatrix: number[][];
  ratings: string[];
  avgDowngradeProbChange: number;
}

@Injectable()
export class CreditMigrationService {
  private readonly logger = new Logger(CreditMigrationService.name);

  // ─── 1. Generate Transition Matrix from Historical Data ────

  generateTransitionMatrix(params: {
    historicalRatings: HistoricalRating[];
  }): TransitionMatrixResult {
    const { historicalRatings } = params;

    // If no historical data, return Moody's defaults
    if (!historicalRatings || historicalRatings.length === 0) {
      return {
        matrix: MOODYS_DEFAULT_MATRIX.map((row) => [...row]),
        ratings: [...STANDARD_RATINGS],
        sampleSize: 0,
        periodCount: 0,
      };
    }

    const ratings = [...STANDARD_RATINGS];
    const ratingIndex = new Map<string, number>();
    ratings.forEach((r, i) => ratingIndex.set(r, i));

    const n = ratings.length;

    // Count transitions between consecutive periods per entity
    const transitionCounts: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0),
    );

    // Group ratings by entity
    const entityMap = new Map<string, { period: number; rating: string }[]>();
    for (const hr of historicalRatings) {
      if (!entityMap.has(hr.entity)) {
        entityMap.set(hr.entity, []);
      }
      entityMap.get(hr.entity)!.push({ period: hr.period, rating: hr.rating });
    }

    let totalTransitions = 0;
    const periods = new Set<number>();

    for (const [, records] of entityMap) {
      // Sort by period
      records.sort((a, b) => a.period - b.period);
      for (const rec of records) {
        periods.add(rec.period);
      }

      // Count transitions between consecutive periods
      for (let i = 0; i < records.length - 1; i++) {
        const fromIdx = ratingIndex.get(records[i].rating);
        const toIdx = ratingIndex.get(records[i + 1].rating);
        if (fromIdx !== undefined && toIdx !== undefined) {
          transitionCounts[fromIdx][toIdx]++;
          totalTransitions++;
        }
      }
    }

    // Normalize rows to probabilities (sum to 1.0)
    const matrix: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0),
    );
    for (let i = 0; i < n; i++) {
      const rowSum = transitionCounts[i].reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        for (let j = 0; j < n; j++) {
          matrix[i][j] = transitionCounts[i][j] / rowSum;
        }
      } else {
        // No observations for this rating: use identity (stay in same rating)
        matrix[i][i] = 1.0;
      }
    }

    return {
      matrix,
      ratings,
      sampleSize: totalTransitions,
      periodCount: periods.size,
    };
  }

  // ─── 2. Project Credit Migration ──────────────────────────

  projectCreditMigration(params: {
    currentPortfolio: PortfolioPosition[];
    transitionMatrix: number[][];
    ratings: string[];
    horizon: number;
  }): ProjectionResult {
    const { currentPortfolio, transitionMatrix, ratings, horizon } = params;
    const n = ratings.length;

    // Build portfolio vector
    const ratingIndex = new Map<string, number>();
    ratings.forEach((r, i) => ratingIndex.set(r, i));

    const portfolioVector = new Array(n).fill(0);
    for (const pos of currentPortfolio) {
      const idx = ratingIndex.get(pos.rating);
      if (idx !== undefined) {
        portfolioVector[idx] += pos.exposure;
      }
    }

    // Matrix exponentiation: M^horizon
    const matrixPow = this.matrixPower(transitionMatrix, horizon);

    // Multiply portfolio vector by M^horizon
    // projectedVector[j] = sum_i (portfolioVector[i] * matrixPow[i][j])
    const projectedVector = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        projectedVector[j] += portfolioVector[i] * matrixPow[i][j];
      }
    }

    const totalExposure = portfolioVector.reduce((a, b) => a + b, 0);

    // Build projected positions
    const projected: ProjectedPosition[] = ratings.map((rating, idx) => {
      const original = portfolioVector[idx];
      const proj = projectedVector[idx];
      const change = proj - original;
      return {
        rating,
        exposure: Math.round(proj * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePct:
          original > 0
            ? Math.round((change / original) * 10000) / 100
            : proj > 0
              ? 100
              : 0,
      };
    });

    // Expected loss = exposure that migrated to default (last rating)
    const defaultIdx = n - 1;
    const expectedLoss =
      projectedVector[defaultIdx] - portfolioVector[defaultIdx];

    // Migration risk: weighted average rating change (downgrade magnitude)
    let migrationRisk = 0;
    if (totalExposure > 0) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (j > i) {
            // Downgrade
            migrationRisk += portfolioVector[i] * matrixPow[i][j] * (j - i);
          }
        }
      }
      migrationRisk = migrationRisk / totalExposure;
    }

    return {
      projected,
      expectedLoss: Math.round(Math.max(0, expectedLoss) * 100) / 100,
      migrationRisk: Math.round(migrationRisk * 10000) / 10000,
    };
  }

  // ─── 3. Estimate Default Probability ──────────────────────

  estimateDefaultProbability(params: {
    currentRating: string;
    transitionMatrix: number[][];
    ratings: string[];
    horizon: number;
  }): DefaultProbabilityResult {
    const { currentRating, transitionMatrix, ratings, horizon } = params;

    const ratingIdx = ratings.indexOf(currentRating);
    if (ratingIdx === -1) {
      return { cumulativePD: 0, marginalPDs: [], survivalProbability: 1 };
    }

    const defaultIdx = ratings.length - 1;
    const marginalPDs: number[] = [];
    let prevCumulativePD = 0;

    // Compute cumulative PD for each year up to horizon
    for (let t = 1; t <= horizon; t++) {
      const matPow = this.matrixPower(transitionMatrix, t);
      const cumulativePDAtT = matPow[ratingIdx][defaultIdx];
      const marginalPD = cumulativePDAtT - prevCumulativePD;
      marginalPDs.push(Math.round(Math.max(0, marginalPD) * 1e8) / 1e8);
      prevCumulativePD = cumulativePDAtT;
    }

    const cumulativePD = prevCumulativePD;

    return {
      cumulativePD: Math.round(cumulativePD * 1e8) / 1e8,
      marginalPDs,
      survivalProbability: Math.round((1 - cumulativePD) * 1e8) / 1e8,
    };
  }

  // ─── 4. Stress Transition Matrix ──────────────────────────

  stressTransitionMatrix(params: {
    baseMatrix: number[][];
    ratings: string[];
    stressFactor: number;
  }): StressedMatrixResult {
    const { baseMatrix, ratings, stressFactor } = params;
    const n = ratings.length;
    const defaultIdx = n - 1;

    const stressedMatrix: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0),
    );

    let totalDowngradeChange = 0;
    let downgradeCount = 0;

    for (let i = 0; i < n; i++) {
      // Default is absorbing: row stays [0,...,0,1]
      if (i === defaultIdx) {
        stressedMatrix[i][defaultIdx] = 1.0;
        continue;
      }

      const stayProb = baseMatrix[i][i];

      // Separate upgrade (j < i), stay (j == i), downgrade (j > i)
      let upgradeSum = 0;
      let downgradeSum = 0;
      for (let j = 0; j < n; j++) {
        if (j < i) upgradeSum += baseMatrix[i][j];
        if (j > i) downgradeSum += baseMatrix[i][j];
      }

      // Apply stress: increase downgrades, decrease upgrades
      let newDowngradeSum = Math.min(downgradeSum * stressFactor, 1.0);
      let newUpgradeSum = Math.max(upgradeSum / stressFactor, 0);

      // Ensure total off-diagonal doesn't exceed 1
      if (newDowngradeSum + newUpgradeSum > 1.0) {
        // Scale down both proportionally
        const scale = 1.0 / (newDowngradeSum + newUpgradeSum);
        newDowngradeSum *= scale;
        newUpgradeSum *= scale;
      }

      const newStayProb = 1.0 - newDowngradeSum - newUpgradeSum;

      // Distribute proportionally within upgrades and downgrades
      for (let j = 0; j < n; j++) {
        if (j < i) {
          stressedMatrix[i][j] =
            upgradeSum > 0
              ? baseMatrix[i][j] * (newUpgradeSum / upgradeSum)
              : 0;
        } else if (j === i) {
          stressedMatrix[i][j] = Math.max(0, newStayProb);
        } else {
          stressedMatrix[i][j] =
            downgradeSum > 0
              ? baseMatrix[i][j] * (newDowngradeSum / downgradeSum)
              : 0;
        }
      }

      // Track downgrade probability change for reporting
      if (downgradeSum > 0) {
        totalDowngradeChange += newDowngradeSum - downgradeSum;
        downgradeCount++;
      }
    }

    const avgDowngradeProbChange =
      downgradeCount > 0 ? totalDowngradeChange / downgradeCount : 0;

    return {
      stressedMatrix,
      ratings: [...ratings],
      avgDowngradeProbChange:
        Math.round(avgDowngradeProbChange * 10000) / 10000,
    };
  }

  // ─── Matrix Utilities ─────────────────────────────────────

  /**
   * Multiply two square matrices.
   */
  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const result: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0),
    );
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  /**
   * Raise a square matrix to a positive integer power via repeated squaring.
   */
  private matrixPower(matrix: number[][], power: number): number[][] {
    const n = matrix.length;
    if (power <= 0) {
      // Return identity matrix
      return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)),
      );
    }
    if (power === 1) {
      return matrix.map((row) => [...row]);
    }

    // Exponentiation by squaring
    let result = this.matrixPower(matrix, Math.floor(power / 2));
    result = this.matrixMultiply(result, result);
    if (power % 2 === 1) {
      result = this.matrixMultiply(result, matrix);
    }
    return result;
  }
}
