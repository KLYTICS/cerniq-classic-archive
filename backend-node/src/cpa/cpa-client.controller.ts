import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CpaClientService } from './cpa-client.service';
import { CpaBulkIngestionService } from './cpa-bulk-ingestion.service';
import { FirmOwnsClientGuard } from './guards/firm-owns-client.guard';
import { AddClientSchema, BulkAddClientsSchema } from './cpa.dto';

@ApiTags('CPA White-Label')
@ApiBearerAuth()
@Controller('api/cpa/firms/:firmId')
@UseGuards(AuthGuard, RolesGuard, FirmOwnsClientGuard)
export class CpaClientController {
  private readonly logger = new Logger(CpaClientController.name);

  constructor(
    private readonly clientService: CpaClientService,
    private readonly bulkIngestion: CpaBulkIngestionService,
  ) {}

  // ─── Client management ────────────────────────────────────────

  // verify:body-trust-skip — CPA-firm cross-tenant add-client operation. The tenancy contract here is "this firm chooses to add this institution as its client" (RolesGuard at class-level gates which firm members can do this); InstitutionScopeGuard wouldn't apply because no CPA firm member is the workspace owner of a client institution. Service-layer validation handles institution-exists + not-already-a-client + firm-under-client-limit. Mirrors the existing skip-comment on the sibling DELETE route (FirmOwnsClientGuard applies to DELETE because the relationship exists; for ADD it doesn't yet).
  @Post('clients')
  @ApiOperation({ summary: 'Add a client institution to the CPA firm' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 201, description: 'Client added' })
  @ApiResponse({ status: 403, description: 'Client limit reached' })
  @ApiResponse({ status: 404, description: 'Firm or institution not found' })
  @ApiResponse({ status: 409, description: 'Already a client' })
  async addClient(@Param('firmId') firmId: string, @Body() body: unknown) {
    const parsed = AddClientSchema.parse(body);
    return this.clientService.addClient(
      firmId,
      parsed.institutionId,
      parsed.brandingOverride,
    );
  }

  // verify:institution-scope-skip — CPA-firm cross-tenant operation. The
  // tenancy contract here is "this firm has a CpaClientRelationship with
  // this institution," not "this user owns this institution" (which is
  // what InstitutionScopeGuard checks). Defense layered:
  //   (1) class-level FirmOwnsClientGuard verifies CpaClientRelationship
  //       exists for (firmId, institutionId) with removedAt=null —
  //       fails fast at 404 before the service touches anything.
  //   (2) CpaClientService.removeClient runs the same lookup internally
  //       and throws NotFoundException — defense-in-depth.
  //   (3) RolesGuard at the class level gates which firm members can
  //       call this at all.
  // Applying InstitutionScopeGuard here would 403 every CPA user because
  // no CPA firm member is the workspace owner of a client institution,
  // so the skip-comment stays — the new FirmOwnsClientGuard replaces
  // the "long-term primitive" originally flagged here as future work.
  @Delete('clients/:institutionId')
  @ApiOperation({ summary: 'Remove a client institution from the CPA firm' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiResponse({ status: 200, description: 'Client removed' })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async removeClient(
    @Param('firmId') firmId: string,
    @Param('institutionId') institutionId: string,
  ) {
    await this.clientService.removeClient(firmId, institutionId);
    return { ok: true };
  }

  @Get('clients')
  @ApiOperation({
    summary: 'List all clients with latest risk score summaries',
  })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'Client list with risk summaries' })
  async listClients(@Param('firmId') firmId: string) {
    return this.clientService.listClients(firmId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregate CPA dashboard across all clients' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'CPA dashboard data' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  async getDashboard(@Param('firmId') firmId: string) {
    return this.clientService.getClientDashboard(firmId);
  }

  // ─── Bulk operations ──────────────────────────────────────────

  @Post('clients/bulk')
  @ApiOperation({ summary: 'Bulk-add multiple client institutions' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 201, description: 'Bulk add results' })
  async bulkAddClients(@Param('firmId') firmId: string, @Body() body: unknown) {
    const parsed = BulkAddClientsSchema.parse(body);
    return this.clientService.bulkAddClients(firmId, parsed.institutionIds);
  }

  @Post('upload-quarterly')
  @ApiOperation({
    summary: 'Upload quarterly CSV data for multiple clients',
  })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Ingestion results' })
  @ApiResponse({ status: 400, description: 'Invalid CSV format' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadQuarterly(
    @Param('firmId') firmId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (
      file.mimetype !== 'text/csv' &&
      file.mimetype !== 'application/vnd.ms-excel'
    ) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Must be text/csv`,
      );
    }

    const parseResult = await this.bulkIngestion.parseQuarterlyUpload(
      firmId,
      file.buffer,
    );

    // If there are parse errors but some institutions parsed, still ingest what we can
    if (
      parseResult.institutions.length === 0 &&
      parseResult.errors.length > 0
    ) {
      return {
        parseResult,
        ingestionResult: null,
        message: 'No valid institutions found in CSV',
      };
    }

    const ingestionResult = await this.bulkIngestion.ingestParsedData(
      firmId,
      parseResult.institutions,
    );

    return {
      parseResult: {
        institutions: parseResult.institutions.length,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      },
      ingestionResult,
    };
  }
}
