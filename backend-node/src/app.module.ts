import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { MarketDataModule } from './market-data/market-data.module';
import { TickerModule } from './ticker/ticker.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RiskModule } from './risk/risk.module';
import { ValuationModule } from './valuation/valuation.module';
import { OptionsModule } from './options/options.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CacheModule } from './cache/cache.module';
import { ExecutionModule } from './execution/execution.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StorageModule } from './storage/storage.module';
import { LlmModule } from './llm/llm.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JobsModule } from './jobs/jobs.module';
import { AlmModule } from './alm/alm.module';

@Module({
  imports: [
    // Rate limiting — 100 requests per minute globally
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule,
    MarketDataModule,
    TickerModule,
    PortfolioModule,
    RiskModule,
    ValuationModule,
    OptionsModule,
    RealtimeModule,
    ExecutionModule,
    // SpendCheck modules
    AuthModule,
    OrganizationsModule,
    ExpensesModule,
    StorageModule,
    LlmModule,
    AnalyticsModule,
    // Data pipeline
    JobsModule,
    // Asset Liability Management
    AlmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
