import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailService } from './email.service';
import { EmailSequenceProcessor } from './email-sequence.processor';
import { PrismaService } from '../prisma.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [EmailService, EmailSequenceProcessor, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
