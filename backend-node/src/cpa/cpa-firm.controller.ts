import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
import { CpaFirmService } from './cpa-firm.service';
import { CpaBrandingService } from './cpa-branding.service';
import {
  CreateCpaFirmSchema,
  UpdateCpaFirmSchema,
  UpdateBrandingSchema,
  ListFirmsQuerySchema,
} from './cpa.dto';

@ApiTags('CPA White-Label')
@ApiBearerAuth()
@Controller('api/cpa/firms')
@UseGuards(AuthGuard, RolesGuard)
export class CpaFirmController {
  private readonly logger = new Logger(CpaFirmController.name);

  constructor(
    private readonly firmService: CpaFirmService,
    private readonly brandingService: CpaBrandingService,
  ) {}

  // ─── Firm CRUD ──────────────────────────────────────────────

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Register a new CPA firm (admin only)' })
  @ApiResponse({ status: 201, description: 'CPA firm created' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async createFirm(@Body() body: unknown) {
    const parsed = CreateCpaFirmSchema.parse(body);
    return this.firmService.createFirm(parsed);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all CPA firms (admin only)' })
  @ApiResponse({ status: 200, description: 'List of CPA firms' })
  async listFirms(@Query() query: unknown) {
    const parsed = ListFirmsQuerySchema.parse(query);
    return this.firmService.listFirms(parsed);
  }

  @Get(':firmId')
  @ApiOperation({ summary: 'Get CPA firm details with client list' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'CPA firm with clients' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  async getFirm(@Param('firmId') firmId: string) {
    return this.firmService.getFirm(firmId);
  }

  @Patch(':firmId')
  @ApiOperation({ summary: 'Update CPA firm details' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'Updated CPA firm' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict' })
  async updateFirm(@Param('firmId') firmId: string, @Body() body: unknown) {
    const parsed = UpdateCpaFirmSchema.parse(body);
    return this.firmService.updateFirm(firmId, parsed);
  }

  @Delete(':firmId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate a CPA firm (admin only)' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'Firm deactivated' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  async deactivateFirm(@Param('firmId') firmId: string) {
    await this.firmService.deactivateFirm(firmId);
    return { ok: true };
  }

  // ─── Branding ─────────────────────────────────────────────────

  @Patch(':firmId/branding')
  @ApiOperation({ summary: 'Update CPA firm branding configuration' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiResponse({ status: 200, description: 'Updated branding' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  async updateBranding(
    @Param('firmId') firmId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateBrandingSchema.parse(body);
    return this.brandingService.updateBranding(firmId, parsed);
  }

  @Post(':firmId/logo')
  @ApiOperation({ summary: 'Upload CPA firm logo' })
  @ApiParam({ name: 'firmId', description: 'CPA firm ID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Logo uploaded, returns URL' })
  @ApiResponse({ status: 400, description: 'Invalid file type' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('firmId') firmId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }

    const url = await this.brandingService.uploadLogo(
      firmId,
      file.buffer,
      file.mimetype,
    );
    return { logoUrl: url };
  }
}
