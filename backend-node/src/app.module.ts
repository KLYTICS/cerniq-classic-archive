import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
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
import { EmailModule } from './email/email.module';
import { LeadsModule } from './leads/leads.module';
import { BillingModule } from './billing/billing.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PortalModule } from './portal/portal.module';
import { FeedbackModule } from './feedback/feedback.module';
import { DataCryptoModule } from './crypto/data-crypto.module';
import { AuditModule } from './audit/audit.module';
import { ApiV1Module } from './api-v1/api-v1.module';

@Module({
  imports: [
    // Rate limiting — 100 requests per minute globally
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    // Application-level encryption (AES-256-GCM)
    DataCryptoModule,
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
    // Email notifications
    EmailModule,
    // Lead pipeline & revenue ops
    LeadsModule,
    // Billing & subscriptions (Stripe)
    BillingModule,
    // Report pipeline automation
    PipelineModule,
    // Client portal API
    PortalModule,
    // Audit trail (COSSEC compliance)
    AuditModule,
    // NPS feedback & surveys
    FeedbackModule,
    // Public API v1 (Swagger-documented, API key auth)
    ApiV1Module,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
