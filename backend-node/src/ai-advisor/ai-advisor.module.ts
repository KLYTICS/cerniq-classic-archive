import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { AiAdvisorService } from './ai-advisor.service';
import { ConversationHistoryService } from './conversation-history.service';
import { AiAdvisorController } from './ai-advisor.controller';
import { AiAdvisorGateway } from './ai-advisor.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [AiAdvisorController],
  providers: [AiAdvisorService, ConversationHistoryService, AiAdvisorGateway],
  exports: [AiAdvisorService],
})
export class AiAdvisorModule {}
