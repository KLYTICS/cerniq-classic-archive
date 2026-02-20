import { Module } from '@nestjs/common';
import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';
import { CyclicalValuationEngine } from './engines/cyclical.engine';
import { CompounderValuationEngine } from './engines/compounder.engine';
import { FrontierValuationEngine } from './engines/frontier.engine';
import { KPIScoringEngine } from './engines/kpi-scoring.engine';
import { MarketDataModule } from '../market-data/market-data.module';
import { TickerModule } from '../ticker/ticker.module';

@Module({
    imports: [MarketDataModule, TickerModule],
    controllers: [ValuationController],
    providers: [
        ValuationService,
        CyclicalValuationEngine,
        CompounderValuationEngine,
        FrontierValuationEngine,
        KPIScoringEngine,
    ],
    exports: [ValuationService],
})
export class ValuationModule { }
