import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { ChartsController } from './charts.controller';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { LlmModule } from '../llm/llm.module';

@Module({
    imports: [LlmModule],
    controllers: [MarketDataController, ChartsController],
    providers: [MarketDataService, TechnicalIndicatorsService, YahooFinanceProvider, CoinGeckoProvider],
    exports: [MarketDataService, TechnicalIndicatorsService],
})
export class MarketDataModule { }
