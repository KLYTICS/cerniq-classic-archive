import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PipelineGateway } from './pipeline.gateway';
import { MarketDataModule } from '../market-data/market-data.module';
import { OptionsModule } from '../options/options.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
    imports: [MarketDataModule, OptionsModule, PortfolioModule],
    providers: [RealtimeGateway, PipelineGateway],
    exports: [RealtimeGateway, PipelineGateway],
})
export class RealtimeModule { }
