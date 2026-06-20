import { Controller, Get, Logger, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthTenantGuard } from '../auth/auth-tenant.guard';
import { InstitutionScopeGuard } from '../agent-api/guards/institution-scope.guard';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { CECLService } from './cecl.service';
import {
  CaelComplianceService,
  type CaelComplianceResult,
} from './cael-compliance.service';

/**
 * CAEL Compliance API (Wave 1, W1.1 Slice 2 — dispatch).
 *
 * Exposes the three quarterly CAEL filings (Reglamento 7790 incurred-loss,
 * CAEL-with-CECL, CAEL Piloto) for one institution over the authenticated ALM
 * surface. A SEPARATE controller — NOT a method on `AlmController` — so it adds
 * zero positional-constructor slots there (the slot-map trap) and needs no
 * `schema.prisma` change: it returns the computed verdicts as JSON; the governed
 * `ReportArtifact` persistence (`CAEL_*` enum, blocked on PR #71) is a later slice.
 *
 * Auth: the class-level `AuthTenantGuard` + `InstitutionScopeGuard` stack mirrors
 * `AlmController` — authentication first, then tenant ownership of `:institutionId`.
 */
@ApiTags('ALM Analysis')
@Controller('api/alm')
@UseGuards(AuthTenantGuard, InstitutionScopeGuard)
export class CaelController {
  private readonly logger = new Logger(CaelController.name);

  constructor(
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly cecl: CECLService,
    private readonly cael: CaelComplianceService,
  ) {}

  /**
   * Compute the three quarterly CAEL variants for an institution. The allowance
   * basis differs per variant — incurred-loss (Reg 8665) for 7790, lifetime WARM
   * for the CECL variant, none for Piloto — which is the reason COSSEC mandates
   * the parallel filings. D1 gaps (asset-quality unavailable, provisional bands)
   * ride along on each result; nothing is fabricated.
   */
  @Get(':institutionId/cael')
  @ApiOperation({
    summary: 'Compute the three quarterly CAEL compliance filings',
  })
  @ApiParam({ name: 'institutionId', description: 'Institution UUID' })
  async getCaelCompliance(
    @Param('institutionId') institutionId: string,
  ): Promise<CaelComplianceResult[]> {
    this.logger.log(`CAEL compliance filings for institution ${institutionId}`);
    const cossec = await this.almEnterprise.getCOSSECCompliance(institutionId);
    const incurred = await this.cecl.getCECLAnalysis(
      institutionId,
      'incurredloss',
    );
    const warm = await this.cecl.getCECLAnalysis(institutionId, 'warm');

    return [
      this.cael.evaluateCaelCompliance(
        this.cael.caelInputsFromEngines('reg7790', cossec.summary, incurred),
      ),
      this.cael.evaluateCaelCompliance(
        this.cael.caelInputsFromEngines('cecl', cossec.summary, warm),
      ),
      this.cael.evaluateCaelCompliance(
        this.cael.caelInputsFromEngines('piloto', cossec.summary, null),
      ),
    ];
  }
}
