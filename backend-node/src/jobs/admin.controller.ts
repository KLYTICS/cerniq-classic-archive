import { Controller, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { DailyPipelineService } from './daily-pipeline.service';

@Controller('api/admin')
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(private readonly pipelineService: DailyPipelineService) {}

    /**
     * POST /api/admin/run-pipeline
     * Manual trigger for the daily data pipeline.
     * Requires JWT auth (checks for Authorization header).
     */
    @Post('run-pipeline')
    async runPipeline(@Headers('authorization') authHeader: string) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication required');
        }

        this.logger.log('Manual pipeline trigger requested');

        const result = await this.pipelineService.runPipeline();

        return {
            message: 'Pipeline execution completed',
            ...result,
        };
    }
}
