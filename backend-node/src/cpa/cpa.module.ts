import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../storage/storage.module';
import { CpaFirmController } from './cpa-firm.controller';
import { CpaClientController } from './cpa-client.controller';
import { CpaFirmService } from './cpa-firm.service';
import { CpaClientService } from './cpa-client.service';
import { CpaBrandingService } from './cpa-branding.service';
import { CpaBulkIngestionService } from './cpa-bulk-ingestion.service';
import { FirmOwnsClientGuard } from './guards/firm-owns-client.guard';

@Module({
  imports: [PrismaModule, EmailModule, StorageModule],
  controllers: [CpaFirmController, CpaClientController],
  providers: [
    CpaFirmService,
    CpaClientService,
    CpaBrandingService,
    CpaBulkIngestionService,
    FirmOwnsClientGuard,
  ],
  exports: [CpaFirmService, CpaClientService],
})
export class CpaModule {}
