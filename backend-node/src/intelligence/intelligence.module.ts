import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceSchedulerService } from './intelligence.scheduler';

@Module({
  controllers: [IntelligenceController],
  providers: [IntelligenceService, IntelligenceSchedulerService],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
