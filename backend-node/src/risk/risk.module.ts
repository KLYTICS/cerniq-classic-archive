import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { AdvancedRiskService } from './advanced-risk.service';
import { VolatilityController } from './volatility.controller';
import { VolatilityService } from './volatility.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PortfolioModule, MarketDataModule, CacheModule],
  controllers: [RiskController, VolatilityController],
  providers: [RiskService, AdvancedRiskService, VolatilityService],
  exports: [RiskService, AdvancedRiskService, VolatilityService],
})
export class RiskModule {}
