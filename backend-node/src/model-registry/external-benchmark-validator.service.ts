/**
 * ExternalBenchmarkValidatorService — FAANG Audit P2.
 *
 * Compares production model outputs against named authoritative external
 * sources (Fed H.15, FFIEC UBPR, COSSEC circulars, ...). Every run emits
 * a `ModelValidationArtifact` with `artifactType: 'benchmark'` so the
 * governance trail lives alongside golden tests.
 *
 * Flow:
 *   caller computes observed from the real model
 *     → validate({ modelKey, observed, benchmarkId, producedBy })
 *     → loads fixture, looks up tolerance, compares
 *     → persists ModelValidationArtifact (SHA-256 of fixture)
 *     → returns ValidationOutcome (passed / gaps / deltas)
 *
 * The service does NOT invoke the 44 production model functions itself —
 * that keeps it unit-testable without a massive DI tree and keeps
 * "compute observed" the caller's responsibility (where the inputs live).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import type {
  ExternalBenchmark,
  Tolerance,
  ValidationInput,
  ValidationOutcome,
} from './external-benchmark.types';
import {
  DEFAULT_TOLERANCE,
  TOLERANCE_BY_MODEL_KEY,
} from './external-benchmark-tolerances';

@Injectable()
export class ExternalBenchmarkValidatorService {
  private readonly logger = new Logger(ExternalBenchmarkValidatorService.name);
  private readonly fixturesDir = path.resolve(
    __dirname,
    'data/external-benchmarks',
  );

  constructor(private readonly registry: ModelRegistryService) {}

  /** Enumerate every external benchmark fixture on disk. */
  listBenchmarks(): ExternalBenchmark[] {
    if (!fs.existsSync(this.fixturesDir)) return [];
    const files = fs
      .readdirSync(this.fixturesDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    return files.map((file) => this.loadFixtureFile(file));
  }

  /** Load one benchmark by id. */
  getBenchmark(id: string): ExternalBenchmark | null {
    return this.listBenchmarks().find((b) => b.id === id) ?? null;
  }

  /** Look up tolerance for a model. Falls back to DEFAULT_TOLERANCE. */
  getTolerance(modelKey: string): Tolerance {
    return TOLERANCE_BY_MODEL_KEY[modelKey] ?? DEFAULT_TOLERANCE;
  }

  /** List benchmark artifacts for a given model (audit trail). */
  async listResults(modelId: string) {
    const model = await this.registry.getById(modelId);
    return (model.validationArtifacts ?? []).filter(
      (a: any) => a.artifactType === 'benchmark',
    );
  }

  /**
   * Validate one observation against one benchmark.
   * Always persists an artifact (even on failure) — the artifact IS the audit evidence.
   */
  async validate(input: ValidationInput): Promise<ValidationOutcome> {
    if (!input.modelKey) {
      throw new BadRequestException('modelKey is required');
    }
    if (!input.benchmarkId) {
      throw new BadRequestException('benchmarkId is required');
    }
    if (!input.producedBy) {
      throw new BadRequestException('producedBy is required for audit trail');
    }

    const benchmark = this.getBenchmark(input.benchmarkId);
    if (!benchmark) {
      throw new NotFoundException(
        `External benchmark not found: ${input.benchmarkId}`,
      );
    }
    if (benchmark.modelKey !== input.modelKey) {
      throw new BadRequestException(
        `Benchmark ${input.benchmarkId} anchors model ${benchmark.modelKey}, not ${input.modelKey}`,
      );
    }

    const tolerance = this.getTolerance(input.modelKey);
    const { absDelta, relDelta, passed } = compareToTolerance(
      input.observed,
      benchmark.expectedValue,
      tolerance,
    );
    const gaps = buildGaps(input.observed, passed, benchmark, tolerance);

    const ranAt = new Date();
    const model = await this.registry
      .getByKey(input.modelKey)
      .catch(() => null);

    let artifactId: string | null = null;
    if (model) {
      try {
        const checksum = this.computeFixtureChecksum(benchmark.id);
        const artifact = await this.registry.addValidationArtifact(model.id, {
          artifactType: 'benchmark',
          label: `External benchmark: ${benchmark.source} ${benchmark.metric} @ ${benchmark.asOfDate}`,
          storageLocator: `model-registry/data/external-benchmarks/${this.resolveFileName(benchmark.id)}`,
          checksum,
          producedBy: input.producedBy,
          producedAt: ranAt,
          validationMetadata: {
            benchmarkId: benchmark.id,
            source: benchmark.source,
            sourceUrl: benchmark.sourceUrl,
            asOfDate: benchmark.asOfDate,
            metric: benchmark.metric,
            units: benchmark.units,
            expected: benchmark.expectedValue,
            observed: input.observed,
            absDelta,
            relDelta,
            tolerance,
            passed,
            gaps,
          },
        });
        artifactId = artifact.id;
      } catch (err: any) {
        // Persisting the artifact is best-effort — never fail the validation call
        // because of audit write trouble. Log loudly, surface as a DataGap.
        this.logger.error(
          `Failed to persist benchmark artifact for ${input.modelKey}: ${err.message}`,
        );
        gaps.push({
          field: 'audit.artifact',
          reason: `ARTIFACT_PERSIST_FAILED: ${err.message}`,
          severity: 'WARNING',
          action:
            'Check ModelValidationArtifact Prisma writes; validation ran but evidence was not stored.',
        });
      }
    } else {
      this.logger.warn(
        `Model key not in registry: ${input.modelKey} — validation ran without artifact persistence.`,
      );
      gaps.push({
        field: 'registry.model',
        reason: `MODEL_NOT_REGISTERED: ${input.modelKey}`,
        severity: 'WARNING',
        action:
          'Register the model via ModelRegistrySeeder before running external validation in production.',
      });
    }

    return {
      benchmarkId: benchmark.id,
      source: benchmark.source,
      sourceUrl: benchmark.sourceUrl,
      modelKey: input.modelKey,
      observed: input.observed,
      expected: benchmark.expectedValue,
      absDelta,
      relDelta,
      tolerance,
      passed,
      artifactId,
      ranAt: ranAt.toISOString(),
      gaps,
    };
  }

  // ─────────────────────── internals ───────────────────────

  private resolveFileName(benchmarkId: string): string {
    // `FED_H15.treasury_10y_par_yield.2026-03-31` → scan dir for matching id
    const files = fs.existsSync(this.fixturesDir)
      ? fs.readdirSync(this.fixturesDir).filter((f) => f.endsWith('.json'))
      : [];
    for (const file of files) {
      const loaded = this.loadFixtureFile(file);
      if (loaded.id === benchmarkId) return file;
    }
    throw new NotFoundException(
      `No fixture file matches benchmark id: ${benchmarkId}`,
    );
  }

  private loadFixtureFile(file: string): ExternalBenchmark {
    const full = path.join(this.fixturesDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const parsed = JSON.parse(raw) as ExternalBenchmark;
    this.assertBenchmarkShape(parsed, file);
    return parsed;
  }

  private assertBenchmarkShape(b: ExternalBenchmark, file: string): void {
    const required: Array<keyof ExternalBenchmark> = [
      'id',
      'source',
      'sourceUrl',
      'asOfDate',
      'metric',
      'expectedValue',
      'units',
      'modelKey',
      'description',
    ];
    for (const key of required) {
      if (b[key] === undefined || b[key] === null || b[key] === '') {
        throw new BadRequestException(
          `Malformed external benchmark fixture ${file}: missing "${String(key)}"`,
        );
      }
    }
    if (!Number.isFinite(b.expectedValue)) {
      throw new BadRequestException(
        `Malformed external benchmark fixture ${file}: expectedValue must be finite number`,
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.asOfDate)) {
      throw new BadRequestException(
        `Malformed external benchmark fixture ${file}: asOfDate must be ISO YYYY-MM-DD`,
      );
    }
  }

  private computeFixtureChecksum(benchmarkId: string): string {
    const file = this.resolveFileName(benchmarkId);
    const content = fs.readFileSync(path.join(this.fixturesDir, file));
    return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
  }
}

// ─────────────────────── pure helpers (easily unit-tested) ───────────────────────

export function compareToTolerance(
  observed: number | null,
  expected: number,
  tolerance: Tolerance,
): {
  absDelta: number | null;
  relDelta: number | null;
  passed: boolean | null;
} {
  if (observed === null || !Number.isFinite(observed)) {
    return { absDelta: null, relDelta: null, passed: null };
  }
  const absDelta = observed - expected;
  const relDelta = expected === 0 ? null : absDelta / Math.abs(expected);

  // If neither gate is set, the tolerance is meaningless — treat as pass but warn upstream.
  if (tolerance.absolute === null && tolerance.relative === null) {
    return { absDelta, relDelta, passed: true };
  }
  const absOk =
    tolerance.absolute === null || Math.abs(absDelta) <= tolerance.absolute;
  const relOk =
    tolerance.relative === null ||
    (relDelta !== null && Math.abs(relDelta) <= tolerance.relative);

  // Both gates must pass when both set; if only one set, only that one applies.
  const passed =
    tolerance.absolute !== null && tolerance.relative !== null
      ? absOk && relOk
      : absOk && relOk;
  return { absDelta, relDelta, passed };
}

export function buildGaps(
  observed: number | null,
  passed: boolean | null,
  benchmark: ExternalBenchmark,
  tolerance: Tolerance,
): ValidationOutcome['gaps'] {
  const gaps: ValidationOutcome['gaps'] = [];
  if (observed === null) {
    gaps.push({
      field: `${benchmark.modelKey}.observed`,
      reason: `OBSERVED_DATA_UNAVAILABLE: model returned null for ${benchmark.metric}`,
      severity: 'CRITICAL',
      action: `Verify required inputs for ${benchmark.modelKey}; external validation skipped this run.`,
    });
    return gaps;
  }
  if (passed === false) {
    const severity = tolerance.onFailure === 'WARN' ? 'WARNING' : 'CRITICAL';
    gaps.push({
      field: `${benchmark.modelKey}.drift`,
      reason: `BENCHMARK_DRIFT_EXCEEDED: observed ${observed} vs expected ${benchmark.expectedValue} (${benchmark.source} ${benchmark.metric} @ ${benchmark.asOfDate})`,
      severity,
      action:
        tolerance.onFailure === 'BLOCK_APPROVAL'
          ? 'Recalibrate model or investigate input drift before next approval cycle.'
          : tolerance.onFailure === 'AUTO_DEPRECATE'
            ? 'Repeated failure will auto-deprecate this model — escalate to model owner.'
            : 'Recalibration recommended — see model owner.',
    });
  }
  return gaps;
}
