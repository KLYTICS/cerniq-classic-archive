import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { PrismaService } from '../prisma.service';

@Module({
    imports: [MarketDataModule],
    controllers: [PortfolioController],
    providers: [PortfolioService, PrismaService],
    exports: [PortfolioService],
})
export class PortfolioModule { }
