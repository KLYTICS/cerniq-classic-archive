import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [LeadsController],
  providers: [LeadsService, PrismaService],
  exports: [LeadsService],
})
export class LeadsModule {}
