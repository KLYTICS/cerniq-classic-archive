import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyPipelineService } from './daily-pipeline.service';
import { DataRetentionService } from './data-retention.service';
import { AdminController } from './admin.controller';
import { PipelineHealthController } from './pipeline-health.controller';
import { MarketDataModule } from '../market-data/market-data.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [ScheduleModule.forRoot(), MarketDataModule, RiskModule],
  controllers: [AdminController, PipelineHealthController],
  providers: [DailyPipelineService, DataRetentionService],
  exports: [DailyPipelineService, DataRetentionService],
})
export class JobsModule {}
