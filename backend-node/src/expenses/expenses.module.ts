import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ApReportService } from './ap-report.service';
import { VendorIntelligenceService } from './vendor-intelligence/vendor-intelligence.service';
import { ExpensesController } from './expenses.controller';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';
import { AlmModule } from '../alm/alm.module';

@Module({
    imports: [LlmModule, StorageModule, AlmModule],
    controllers: [ExpensesController],
    providers: [ExpensesService, AnomalyDetectionService, ApReportService, VendorIntelligenceService],
    exports: [ExpensesService, AnomalyDetectionService, ApReportService, VendorIntelligenceService],
})
export class ExpensesModule { }
