import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { DailyPipelineService } from './daily-pipeline.service';

@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly pipelineService: DailyPipelineService) {}

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  /**
   * POST /api/admin/run-pipeline
   * Manual trigger for the daily data pipeline.
   * Requires ADMIN_KEY header.
   */
  @Post('run-pipeline')
  async runPipeline(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);

    this.logger.log('Manual pipeline trigger requested');

    const result = await this.pipelineService.runPipeline();

    return {
      message: 'Pipeline execution completed',
      ...result,
    };
  }
}
