import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NcuaImportService } from './ncua-import.service';
import { NcuaApiService } from './ncua-api.service';
import { NcuaFieldMapperService } from './ncua-field-mapper.service';
import { AuthTenantGuard } from '../auth/auth-tenant.guard';
import { InstitutionScopeGuard } from '../agent-api/guards/institution-scope.guard';
import {
  ImportBodySchema,
  SearchQuerySchema,
  SyncParamSchema,
  parseOrThrow,
} from './ncua.dto';

/**
 * NCUA Integration Controller — W3-3
 *
 * Provides endpoints to import credit union data from the NCUA Form 5300
 * call report system, search the NCUA database, sync existing institutions,
 * and inspect the field mapping documentation.
 *
 * Class-level cross-tenant stack. AuthTenantGuard (auth + tenant resolution)
 * runs first; InstitutionScopeGuard verifies ownership of `:institutionId`
 * when the route carries it (sync). Non-`:institutionId` routes (import,
 * search, field-map) pass through the institution check but still get
 * authenticated by AuthTenantGuard — closing the prior gap where the entire
 * controller was unauthenticated.
 */
@Controller('api/ncua')
@UseGuards(AuthTenantGuard, InstitutionScopeGuard)
export class NcuaController {
  private readonly logger = new Logger(NcuaController.name);

  constructor(
    private readonly importService: NcuaImportService,
    private readonly apiService: NcuaApiService,
    private readonly fieldMapper: NcuaFieldMapperService,
  ) {}

  // ─── POST /api/ncua/import ────────────────────────────────────────────────

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importCreditUnion(@Body() body: unknown) {
    let dto;
    try {
      dto = parseOrThrow(ImportBodySchema, body);
    } catch (err: any) {
      throw new BadRequestException(err.issues ?? err.message);
    }

    this.logger.log({
      msg: 'NCUA import requested',
      charterNumber: dto.charterNumber,
      workspaceId: dto.workspaceId,
    });

    const result = await this.importService.importCreditUnion(
      dto.charterNumber,
      dto.workspaceId,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ─── GET /api/ncua/search ─────────────────────────────────────────────────

  @Get('search')
  async searchCreditUnions(@Query() query: unknown) {
    let dto;
    try {
      dto = parseOrThrow(SearchQuerySchema, query);
    } catch (err: any) {
      throw new BadRequestException(err.issues ?? err.message);
    }

    this.logger.log({
      msg: 'NCUA search',
      name: dto.name,
      state: dto.state,
    });

    const results = await this.apiService.searchByName(dto.name, dto.state);

    return {
      success: true,
      count: results.length,
      data: results,
    };
  }

  // ─── POST /api/ncua/sync/:institutionId ───────────────────────────────────

  @Post('sync/:institutionId')
  async syncCreditUnion(@Param() params: unknown) {
    let dto;
    try {
      dto = parseOrThrow(SyncParamSchema, params);
    } catch (err: any) {
      throw new BadRequestException(err.issues ?? err.message);
    }

    this.logger.log({
      msg: 'NCUA sync requested',
      institutionId: dto.institutionId,
    });

    const result = await this.importService.syncCreditUnion(dto.institutionId);

    return {
      success: true,
      data: result,
    };
  }

  // ─── GET /api/ncua/field-map ──────────────────────────────────────────────
  // Returns the complete NCUA ACCT code → CERNIQ field mapping for API
  // consumers and documentation.

  @Get('field-map')
  getFieldMap() {
    const fields = this.fieldMapper.getFieldMap();

    return {
      success: true,
      count: fields.length,
      description:
        'Maps NCUA Form 5300 ACCT codes to CERNIQ balance sheet fields. ' +
        'Each entry includes bilingual labels (EN/ES) and category classification.',
      data: fields.map((f) => ({
        ncuaAcctCode: f.acctCode,
        category: f.category,
        subcategory: f.subcategory,
        name: f.name,
        nameEs: f.nameEs,
        rateType: f.rateType ?? null,
      })),
    };
  }
}
