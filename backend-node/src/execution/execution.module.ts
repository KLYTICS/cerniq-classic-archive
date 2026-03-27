import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { BacktestService } from './backtest.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [MarketDataModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, BacktestService],
  exports: [ExecutionService, BacktestService],
})
export class ExecutionModule {}
