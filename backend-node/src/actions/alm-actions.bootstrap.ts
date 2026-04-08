/**
 * AlmActionsBootstrap — registers the first wave of ALM actions in the
 * action registry on module init.
 *
 * The pattern: this provider implements `OnModuleInit` and depends on
 * the registry plus the ALM services it wraps. When NestJS finishes
 * constructing the AlmModule, this runs once and registers each action
 * with metadata + a thin handler that delegates to the underlying service.
 *
 * Why a separate bootstrap class instead of decorators on service methods:
 *   - Keeps the registration list inspectable in one file (the audit
 *     manifest of "what can users do via /actions").
 *   - Avoids decorator metadata reflection at runtime (which has CommonJS
 *     interop quirks in this NestJS 11 + nodenext setup).
 *   - Lets the metadata live next to the labels and permissions instead
 *     of being scattered across services.
 *
 * Adding a new action is two lines: a `register()` call here plus a
 * service method to delegate to. The frontend command palette picks it
 * up from `GET /api/actions` automatically.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ActionRegistryService } from './action-registry.service';
import { InstitutionSeedService } from '../alm/institution-seed.service';
import { ReportPreflightService } from '../alm/reports/report-preflight.service';

@Injectable()
export class AlmActionsBootstrap implements OnModuleInit {
  private readonly logger = new Logger(AlmActionsBootstrap.name);

  constructor(
    private readonly registry: ActionRegistryService,
    private readonly institutionSeed: InstitutionSeedService,
    private readonly reportPreflight: ReportPreflightService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        id: 'institution.seed',
        label: {
          en: 'Seed institution from fixture',
          es: 'Sembrar institución desde fixture',
        },
        module: 'alm',
        description: {
          en: 'Idempotent: re-running with the same fixture upserts and reports the delta. Phase 1 contract.',
          es: 'Idempotente: reejecutar con el mismo fixture actualiza y reporta el delta. Contrato Fase 1.',
        },
        requiresConfirm: false,
        audit: true,
        estimatedDurationMs: 1500,
      },
      async (input) => {
        const workspaceId =
          typeof input.workspaceId === 'string' ? input.workspaceId : '';
        const fixture = typeof input.fixture === 'string' ? input.fixture : '';
        if (!workspaceId || !fixture) {
          return {
            success: false,
            error: 'workspaceId and fixture are required',
            durationMs: 0,
          };
        }
        const result = await this.institutionSeed.seedFromFixture(
          workspaceId,
          fixture,
        );
        return result;
      },
    );

    this.registry.register(
      {
        id: 'alm.preflight',
        label: {
          en: 'Run report preflight',
          es: 'Ejecutar verificación previa del informe',
        },
        module: 'alm',
        description: {
          en: 'Aggregates ALM summary, COSSEC compliance, and regulatory stress into one gap manifest. ready=true means no CRITICAL gaps.',
          es: 'Agrega resumen ALM, cumplimiento COSSEC y estrés regulatorio en un manifiesto de brechas. ready=true significa sin brechas CRÍTICAS.',
        },
        requiresConfirm: false,
        audit: true,
        estimatedDurationMs: 800,
      },
      async (input) => {
        const institutionId = String(input.institutionId ?? '');
        if (!institutionId) {
          return {
            success: false,
            error: 'institutionId is required',
            durationMs: 0,
          };
        }
        const preflight = await this.reportPreflight.check(institutionId);
        return {
          success: preflight.ready,
          data: preflight,
          durationMs: 0, // dispatcher will fill in
          criticalGapCount: preflight.criticalCount,
          warningGapCount: preflight.warningCount,
        };
      },
    );

    this.logger.log(
      `AlmActionsBootstrap: registered ${this.registry.list({ module: 'alm' }).length} ALM actions`,
    );
  }
}
