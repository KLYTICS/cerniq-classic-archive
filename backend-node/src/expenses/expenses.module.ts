import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ExpensesController } from './expenses.controller';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [LlmModule, StorageModule],
    controllers: [ExpensesController],
    providers: [ExpensesService, AnomalyDetectionService],
    exports: [ExpensesService, AnomalyDetectionService],
})
export class ExpensesModule { }
