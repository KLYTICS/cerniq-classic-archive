import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceSchedulerService } from './intelligence.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, IntelligenceSchedulerService],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
