import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PipelineWorker } from './pipeline.worker';
import { PipelineHealthMonitor } from './pipeline-health.monitor';
import { PipelineController } from './pipeline.controller';
import { ReportStorageService } from './report-storage.service';
import { EmailModule } from '../email/email.module';
import { AlmModule } from '../alm/alm.module';

@Module({
  imports: [ScheduleModule.forRoot(), EmailModule, AlmModule],
  controllers: [PipelineController],
  providers: [PipelineWorker, PipelineHealthMonitor, ReportStorageService],
  exports: [PipelineWorker, ReportStorageService],
})
export class PipelineModule {}
