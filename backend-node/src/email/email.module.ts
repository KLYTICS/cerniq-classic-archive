import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailSequenceProcessor } from './email-sequence.processor';

@Global()
@Module({
  providers: [EmailService, EmailSequenceProcessor],
  exports: [EmailService],
})
export class EmailModule {}
