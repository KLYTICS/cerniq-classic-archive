import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottleGuard } from './common/guards/user-throttle.guard';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-query.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ApiVersionMiddleware } from './common/middleware/api-version.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
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
import { ComplianceModule } from './compliance/compliance.module';

@Module({
  imports: [
    // Sentry error tracking (must be first)
    SentryModule.forRoot(),
    // Structured JSON logging
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-admin-key"]'],
        serializers: {
          req: (req) => ({ method: req.method, url: req.url, id: req.id }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
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
    // SOC 2 Type II compliance automation
    ComplianceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: UserThrottleGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SlowRequestInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, ApiVersionMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
