import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { ChartsController } from './charts.controller';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { FredProvider } from './providers/fred.provider';
import { TreasuryFiscalDataProvider } from './providers/treasury-fiscal-data.provider';
import { LlmModule } from '../llm/llm.module';
import { DataQualityService } from '../common/data-quality.service';
import { MarketStreamManagerService } from './market-stream-manager.service';

@Module({
  imports: [LlmModule],
  controllers: [MarketDataController, ChartsController],
  providers: [
    MarketDataService,
    TechnicalIndicatorsService,
    YahooFinanceProvider,
    CoinGeckoProvider,
    FredProvider,
    TreasuryFiscalDataProvider,
    DataQualityService,
    MarketStreamManagerService,
  ],
  exports: [
    MarketDataService,
    TechnicalIndicatorsService,
    MarketStreamManagerService,
  ],
})
export class MarketDataModule {}
