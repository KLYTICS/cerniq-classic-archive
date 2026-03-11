import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
    imports: [MarketDataModule],
    controllers: [PortfolioController],
    providers: [PortfolioService],
    exports: [PortfolioService],
})
export class PortfolioModule { }
