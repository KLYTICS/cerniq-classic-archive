import { Module } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';
import { PipelineHealthService } from './pipeline-health.service';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, PipelineHealthService],
  exports: [RevenueService],
})
export class RevenueModule {}
