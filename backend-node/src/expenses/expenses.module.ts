import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PrismaService } from '../prisma.service';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [LlmModule, StorageModule],
    controllers: [ExpensesController],
    providers: [ExpensesService, PrismaService],
    exports: [ExpensesService],
})
export class ExpensesModule { }
