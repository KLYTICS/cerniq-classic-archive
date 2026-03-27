# CERNIQ Enterprise Engineering Bible

## Overview

CERNIQ is a bilingual ALM (Asset-Liability Management) reporting platform for Puerto Rico cooperativas and credit unions. This document serves as the authoritative reference for all engineering practices, architecture decisions, and operational procedures.

**Stack:**
- Backend: NestJS 11 (Node.js), PostgreSQL 15 + Prisma 7 ORM, Redis 7
- Frontend: Next.js 16 + React 19
- Storage: Cloudflare R2
- Auth: Supabase JWT
- Payments: Stripe
- Email: Resend
- Deployment: Railway (backend) + Vercel (frontend)

---

## 1. Engineering Philosophy & Standards

### 1.1 Code Quality Standards

Every line of code at CERNIQ must:

1. **Pass strict TypeScript compilation** (`strict: true` in tsconfig.json)
   - No `any` types without explicit `// @ts-expect-error` comments with justification
   - All function parameters and return types must be explicitly typed
   - Use discriminated unions over simple unions for type safety

2. **Follow SOLID principles**
   - Single Responsibility: Each class/service does one thing
   - Open/Closed: Open for extension, closed for modification
   - Liskov Substitution: Subtypes must be substitutable
   - Interface Segregation: Many client-specific interfaces over monolithic ones
   - Dependency Inversion: Depend on abstractions, not concrete implementations

3. **Maintain code readability**
   - Functions < 50 lines (hard limit)
   - Variables named explicitly (no `data`, `temp`, `result` unless context is obvious)
   - Comments explain "why", not "what"
   - Avoid deeply nested conditionals (max 2 levels, else extract to separate function)

4. **Test coverage**
   - Minimum 80% coverage for ALM calculation engine
   - 70% for controllers and HTTP layer
   - Unit test all business logic
   - Integration tests for module interactions

### 1.2 NestJS Module Design Principles

NestJS modules are organizational units. Each module:

1. **Has a single business domain** (auth, portfolio, valuation, etc.)
2. **Exports only public interfaces** through module exports
3. **Encapsulates all implementation details**
4. **Declares its external dependencies** in imports
5. **Uses dependency injection** for all services

```typescript
// Example: Good module structure
@Module({
  imports: [PrismaModule, RedisModule, ConfigModule],
  providers: [
    PortfolioService,
    PortfolioCalculationService,
    {
      provide: PORTFOLIO_CACHE_KEY,
      useValue: 'portfolio:cache:v1',
    },
  ],
  controllers: [PortfolioController],
  exports: [PortfolioService], // Only export the public service
})
export class PortfolioModule {}
```

**Module responsibilities are NOT shared.** If two modules both need a service, create a shared module that exports it.

### 1.3 Database-First vs Code-First Decisions

**CERNIQ uses database-first with Prisma schema as source of truth:**

1. **Schema changes start in Prisma schema** (`prisma/schema.prisma`)
2. **Run `prisma migrate dev --name feature_name`** to generate migrations
3. **Migrations are version-controlled and immutable** (never edit existing migrations)
4. **Code generation flows from schema** (TypeScript types generated from Prisma)

Why: Ensures database integrity and makes migrations explicit and reviewable.

```prisma
// prisma/schema.prisma example
model Portfolio {
  id                String   @id @default(cuid())
  organizationId    String
  workspaceId       String
  name              String
  description       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  assets            Asset[]

  @@index([organizationId])
  @@index([workspaceId])
  @@unique([organizationId, workspaceId, name])
}
```

### 1.4 API Design Standards

**REST conventions enforced:**

| Operation | Method | Path | Response |
|-----------|--------|------|----------|
| List | GET | `/api/v1/resource` | 200 + array |
| Get one | GET | `/api/v1/resource/:id` | 200 + object |
| Create | POST | `/api/v1/resource` | 201 + created object |
| Update | PATCH | `/api/v1/resource/:id` | 200 + updated object |
| Delete | DELETE | `/api/v1/resource/:id` | 204 (no content) |
| Action | POST | `/api/v1/resource/:id/action` | 200 + result |

**API Versioning Strategy:**
- URL-based versioning: `/api/v1/`, `/api/v2/`
- Version deprecation requires 6-month notice
- Maintain N-1 versions (current + previous)
- Major schema changes trigger new version

**Error Response Format (ALWAYS consistent):**

```json
{
  "code": "INVALID_PORTFOLIO_ID",
  "message": "Portfolio with ID xyz not found",
  "statusCode": 404,
  "timestamp": "2026-03-27T14:32:00Z",
  "path": "/api/v1/portfolios/xyz",
  "details": {
    "portfolioId": "xyz"
  }
}
```

Every API response must follow this format. Use HTTP status codes correctly:
- 200: Success
- 201: Created
- 204: No content
- 400: Bad request (validation error)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (authenticated but not allowed)
- 404: Not found
- 409: Conflict (duplicate, race condition)
- 429: Rate limited
- 500: Server error
- 503: Service unavailable

### 1.5 Error Handling Philosophy

**Never swallow errors.** Every error must be handled explicitly or propagated.

1. **Identify errors at point of occurrence**
2. **Log with context** (but no PII or tokens)
3. **Transform to business error** if applicable
4. **Return structured response** to client
5. **Alert on-call** for critical errors (via Sentry)

```typescript
// GOOD: Error is identified, logged, and transformed
async findPortfolio(id: string): Promise<Portfolio> {
  const portfolio = await this.prisma.portfolio.findUnique({
    where: { id },
  });

  if (!portfolio) {
    this.logger.warn('Portfolio not found', { portfolioId: id });
    throw new NotFoundException(
      `Portfolio ${id} not found`,
      'PORTFOLIO_NOT_FOUND'
    );
  }

  return portfolio;
}

// BAD: Error is caught and ignored
async findPortfolio(id: string): Promise<Portfolio | null> {
  try {
    return await this.prisma.portfolio.findUnique({
      where: { id },
    });
  } catch (error) {
    return null; // ❌ Error swallowed, caller won't know what happened
  }
}
```

### 1.6 Logging Standards

**What to log:**

- Transaction IDs (correlation IDs for tracing)
- Business events (user created, portfolio updated, ALM calculated)
- Error conditions with context
- Performance metrics (query time, API latency)
- Security events (authentication attempts, permission denials)

**What NOT to log:**

- Passwords, API keys, tokens, secrets (even sanitized)
- PII (SSNs, credit card numbers, personal email/phone)
- Request/response bodies containing sensitive data
- Database credentials

**Logging implementation:**

```typescript
import { Logger } from '@nestjs/common';
import * as pino from 'pino';

// Use structured logging with Pino
export const logger = pino.default({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});

// In services:
@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto, userId: string) {
    const correlationId = generateUUID();
    const startTime = performance.now();

    try {
      const portfolio = await this.prisma.portfolio.create({
        data: {
          ...dto,
          organizationId: userId,
        },
      });

      const duration = performance.now() - startTime;
      this.logger.log('Portfolio created', {
        correlationId,
        portfolioId: portfolio.id,
        duration,
      });

      return portfolio;
    } catch (error) {
      this.logger.error('Failed to create portfolio', {
        correlationId,
        error: error.message,
        // Don't log the entire error object if it contains PII
      });
      throw error;
    }
  }
}
```

**Log levels:**
- ERROR: Unrecoverable failures (database down, auth service unavailable)
- WARN: Recoverable issues (validation failed, retry #2 of 3)
- INFO: Business events (user created, calculation completed)
- DEBUG: Detailed execution flow (entering function, variable values)

---

## 2. NestJS Module Architecture

CERNIQ consists of 28 core modules. Each module is documented below with its purpose, key services, controllers, and dependencies.

### 2.1 Auth Module

**Purpose:** Handle authentication (JWT, API keys, magic links) and authorization.

**Key Services:**
- `AuthService`: JWT generation, token validation, API key verification
- `TokenService`: Access/refresh token lifecycle management
- `PasswordService`: Bcrypt hashing and verification
- `ApiKeyService`: API key generation, hashing (SHA-256+pepper), expiration

**Controllers:**
```
POST   /api/v1/auth/register          Register new user
POST   /api/v1/auth/login             Email/password login
POST   /api/v1/auth/refresh           Refresh access token
POST   /api/v1/auth/logout            Invalidate tokens
POST   /api/v1/auth/magic-link        Send passwordless link
GET    /api/v1/auth/magic-link/:code Verify magic link
POST   /api/v1/auth/api-key           Generate API key
DELETE /api/v1/auth/api-key/:keyId    Revoke API key
```

**Key Guards:**
- `AuthGuard`: Validates JWT in Authorization header
- `AdminKeyGuard`: Validates API key (system-level)
- `OptionalAuthGuard`: Allows both authenticated and anonymous requests

**DTOs:**

```typescript
export class LoginDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain uppercase' })
  @Matches(/[0-9]/, { message: 'Password must contain number' })
  password: string;
}

export class AuthResponseDto {
  accessToken: string;  // JWT, 24h expiration
  refreshToken: string; // 7d rotation, httpOnly cookie
  user: {
    id: string;
    email: string;
    role: 'OWNER' | 'ANALYST' | 'VIEWER';
  };
}

export class ApiKeyResponseDto {
  id: string;
  prefix: string; // First 8 chars, visible to user
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date; // Optional, default never expires
}
```

**Dependencies:** Prisma, Config, Supabase

**Token Lifecycle:**
- Access token: 24 hours, contains userId + workspace scopes
- Refresh token: 7 days, rotates on use, stored as httpOnly cookie
- API keys: No expiration by default, but immutable and prefixed (alm_xxxxxxxxxxxxxxxxxxxx)

### 2.2 Organizations Module

**Purpose:** Manage organization (cooperativa/credit union) accounts and workspaces.

**Key Services:**
- `OrganizationService`: CRUD operations, member management
- `WorkspaceService`: Workspace creation, settings, invite flow
- `InvitationService`: Email invitations with join codes

**Controllers:**
```
POST   /api/v1/organizations           Create organization
GET    /api/v1/organizations/:id       Get organization details
PATCH  /api/v1/organizations/:id       Update organization
DELETE /api/v1/organizations/:id       Delete (with cascade)
GET    /api/v1/organizations/:id/members
POST   /api/v1/organizations/:id/members/:userId/role   Change member role
DELETE /api/v1/organizations/:id/members/:userId        Remove member

POST   /api/v1/workspaces             Create workspace
GET    /api/v1/workspaces/:id         Get workspace
PATCH  /api/v1/workspaces/:id         Update workspace
POST   /api/v1/workspaces/:id/invite  Send member invitation
```

**Key Guard:**
- `OrganizationGuard`: Validates user has access to specified organization
- `WorkspaceGuard`: Validates user has access to specified workspace

**DTOs:**

```typescript
export class CreateOrganizationDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEnum(['cooperativa', 'credit_union'])
  type: 'cooperativa' | 'credit_union';

  @IsString()
  registrationNumber: string; // COOP registration or similar

  @IsString()
  contactEmail: string;

  @IsString()
  @IsPhoneNumber('PR')
  contactPhone: string;
}

export class OrganizationResponseDto {
  id: string;
  name: string;
  type: string;
  registrationNumber: string;
  createdAt: Date;
  memberCount: number;
  workspaceCount: number;
}
```

**Dependencies:** Prisma, Auth, Email

### 2.3 ALM (Asset-Liability Management) Module

**Purpose:** Core business logic for ALM calculations, maturity analysis, stress testing.

**Key Services:**
- `AlmService`: Main calculation engine
- `MaturityAnalysisService`: Interest rate repricing schedules
- `StressTestingService`: Scenario analysis
- `GapAnalysisService`: Asset-liability gap calculations
- `CashFlowService`: Present value, duration calculations

**Controllers:**
```
POST   /api/v1/alm/calculate          Run ALM calculation
GET    /api/v1/alm/results/:id        Get calculation results
GET    /api/v1/alm/results             List calculations
POST   /api/v1/alm/stress-test        Run stress test scenario
GET    /api/v1/alm/maturity           Get maturity schedule
```

**Key Interceptors:**
- `AlmCachingInterceptor`: Cache 10-minute old calculations (Redis)
- `PerformanceInterceptor`: Track calculation time

**DTOs:**

```typescript
export class CalculateAlmDto {
  @IsString()
  portfolioId: string;

  @IsDateString()
  asOfDate: Date;

  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'annual'])
  reportingFrequency: string;

  stressScenarios?: {
    interestRateShift: number; // e.g., +0.50 for +50bps
    spreadShift: number;
    volumeShift: number;
  }[];
}

export class AlmResultDto {
  id: string;
  portfolioId: string;
  asOfDate: Date;
  totalAssets: number;
  totalLiabilities: number;
  netInterestMargin: number;

  maturityGaps: {
    period: string;
    assetGap: number;
    weightedGap: number;
  }[];

  rateRisks: {
    duration: number;
    convexity: number;
    keyRateDurations: Record<string, number>;
  };

  calculatedAt: Date;
  calculationTimeMs: number;
}
```

**Performance Requirements:**
- Full ALM calculation: < 50ms for portfolios < 10,000 assets
- Maturity analysis: < 20ms
- Stress testing: < 500ms for 5 scenarios
- Cache hit ratio target: > 70%

**Dependencies:** Prisma, Redis, Portfolio, Valuation

### 2.4 Risk Module

**Purpose:** Risk measurement, reporting, and compliance.

**Key Services:**
- `RiskService`: VAR, stress test, scenario analysis
- `RiskMetricsService`: Calculate market risk metrics
- `RiskReportService`: Generate risk reports
- `RiskLimitService`: Manage and check risk limits

**Controllers:**
```
GET    /api/v1/risk/metrics/:portfolioId           Get risk metrics
POST   /api/v1/risk/var                            Calculate VAR
POST   /api/v1/risk/stress-test                    Run risk stress test
GET    /api/v1/risk/limits/:organizationId         Get risk limits
POST   /api/v1/risk/limits/:organizationId         Set risk limits
GET    /api/v1/risk/limit-breach/:organizationId   Get breaches
```

**DTOs:**

```typescript
export class RiskMetricsDto {
  portfolioId: string;
  valueAtRisk: number;      // 99% confidence, 1-day
  expectedShortfall: number; // Tail risk
  stressLossBasis: number;   // -100bps scenario
  concentrationRatio: number; // Herfindahl index
}

export class RiskLimitDto {
  portfolioId: string;
  varLimit: number;
  concentrationLimit: number;
  durationLimit: number;
  spreadRiskLimit: number;
}
```

**Dependencies:** Prisma, Portfolio, Valuation, ALM

---

## 2.5-2.28 Additional Modules (Continued in next section)

The following 24 modules follow the same pattern:

**Options Module:** Derivative valuation, Greeks calculation, option-adjusted spread
**Execution Module:** Trade execution simulation, slippage calculation, order routing
**Billing Module:** Usage tracking, invoice generation, subscription management
**Portal Module:** User dashboard, reporting UI, export functionality
**Leads Module:** Sales lead management, conversion tracking
**Market Data Module:** Market data ingestion, pricing feeds, vendor management
**Ticker Module:** Instrument master data, price history, mapping
**Portfolio Module:** Asset management, rebalancing, benchmarks
**Valuation Module:** Fair value calculation, mark-to-market, curves
**Expenses Module:** Operational cost tracking, ratio calculations
**Email Module:** Transactional email, templates, SMTP wrapper
**Storage Module:** File upload/download, R2 integration, presigned URLs
**Jobs Module:** BullMQ job queue, background task scheduling
**Analytics Module:** Event tracking, usage metrics, dashboards
**Audit Module:** Change logging, compliance audit trail
**Pipeline Module:** Sales pipeline stages, opportunity tracking
**Security Module:** Encryption/decryption, API rate limiting
**Crypto Module:** Cryptocurrency asset handling, blockchain integration

Each follows the same pattern: Service → Controller → DTO → Guard/Interceptor → Dependencies.

---

## 3. Adding a New Feature: Step-by-Step Template

This checklist ensures every new feature is properly integrated into the CERNIQ system.

### 3.1 Phase 1: Database Schema

**Step 1: Define Prisma model**

```prisma
// prisma/schema.prisma
model CustomReport {
  id                String   @id @default(cuid())
  organizationId    String
  workspaceId       String
  name              String
  description       String?
  reportType        String   @default("custom")
  createdById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  workspace         Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy         User         @relation(fields: [createdById], references: [id])

  @@index([organizationId])
  @@index([workspaceId])
  @@unique([organizationId, workspaceId, name])
}
```

**Step 2: Create migration**

```bash
cd backend-node
npx prisma migrate dev --name add_custom_reports
```

This generates:
- `prisma/migrations/20260327_add_custom_reports/migration.sql`
- TypeScript types in `@prisma/client`

**Step 3: Verify migration**

```bash
npx prisma db push  # Apply to dev DB
npx prisma studio  # Inspect schema
```

### 3.2 Phase 2: Backend Service & Controller

**Step 4: Create service**

```typescript
// backend-node/src/custom-reports/custom-reports.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomReportDto } from './dto/create-custom-report.dto';

@Injectable()
export class CustomReportsService {
  constructor(private prisma: PrismaService) {}

  async create(
    organizationId: string,
    workspaceId: string,
    userId: string,
    dto: CreateCustomReportDto,
  ) {
    return this.prisma.customReport.create({
      data: {
        ...dto,
        organizationId,
        workspaceId,
        createdById: userId,
      },
    });
  }

  async findByWorkspace(workspaceId: string, limit = 20, offset = 0) {
    const [reports, total] = await Promise.all([
      this.prisma.customReport.findMany({
        where: { workspaceId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customReport.count({ where: { workspaceId } }),
    ]);

    return { reports, total, offset, limit };
  }

  async findById(id: string) {
    const report = await this.prisma.customReport.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, email: true } } },
    });

    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }

    return report;
  }

  async update(id: string, userId: string, dto: Partial<CreateCustomReportDto>) {
    const report = await this.findById(id);

    // Authorization check
    if (report.createdById !== userId) {
      throw new ForbiddenException('Can only edit own reports');
    }

    return this.prisma.customReport.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const report = await this.findById(id);

    if (report.createdById !== userId) {
      throw new ForbiddenException('Can only delete own reports');
    }

    await this.prisma.customReport.delete({ where: { id } });
  }
}
```

**Step 5: Create controller**

```typescript
// backend-node/src/custom-reports/custom-reports.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceGuard } from '../organizations/guards/workspace.guard';
import { CustomReportsService } from './custom-reports.service';
import { CreateCustomReportDto } from './dto/create-custom-report.dto';

@Controller('api/v1/custom-reports')
@UseGuards(AuthGuard, WorkspaceGuard)
export class CustomReportsController {
  constructor(private service: CustomReportsService) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateCustomReportDto,
  ) {
    const workspaceId = user.activeWorkspace;
    const organizationId = user.activeOrganization;

    return this.service.create(organizationId, workspaceId, user.id, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const workspaceId = user.activeWorkspace;
    return this.service.findByWorkspace(
      workspaceId,
      parseInt(limit || '20'),
      parseInt(offset || '0'),
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: Partial<CreateCustomReportDto>,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user.id);
  }
}
```

### 3.3 Phase 3: DTOs & Validation

**Step 6: Create DTOs**

```typescript
// backend-node/src/custom-reports/dto/create-custom-report.dto.ts
import { IsString, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateCustomReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(['monthly', 'quarterly', 'annual'])
  reportType: string;
}

export class CustomReportResponseDto {
  id: string;
  name: string;
  description: string;
  reportType: string;
  createdBy: { id: string; email: string };
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.4 Phase 4: Guards & Interceptors

**Step 7: Create workspace guard**

```typescript
// backend-node/src/organizations/guards/workspace.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user.activeWorkspace) {
      throw new ForbiddenException('No active workspace');
    }

    // Verify user has access to this workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId: user.activeWorkspace,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to workspace');
    }

    request.user.role = membership.role; // Attach role for RBAC
    return true;
  }
}
```

### 3.5 Phase 5: Testing

**Step 8: Write unit tests**

```typescript
// backend-node/src/custom-reports/custom-reports.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CustomReportsService } from './custom-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CustomReportsService', () => {
  let service: CustomReportsService;
  let prisma: PrismaService;

  const mockPrisma = {
    customReport: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomReportsService>(CustomReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a custom report', async () => {
    const dto = { name: 'Q1 Report', reportType: 'quarterly' };
    const expected = { id: '123', ...dto, createdById: 'user1' };

    mockPrisma.customReport.create.mockResolvedValue(expected);

    const result = await service.create('org1', 'ws1', 'user1', dto);

    expect(result).toEqual(expected);
    expect(mockPrisma.customReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining(dto),
    });
  });

  it('should throw NotFoundException when report not found', async () => {
    mockPrisma.customReport.findUnique.mockResolvedValue(null);

    await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own report', async () => {
    const report = { id: '123', createdById: 'user2' };
    mockPrisma.customReport.findUnique.mockResolvedValue(report);

    await expect(
      service.delete('123', 'user1')
    ).rejects.toThrow(ForbiddenException);
  });
});
```

**Step 9: Write E2E tests**

```typescript
// backend-node/test/custom-reports.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Custom Reports (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login and get token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Test1234!' });

    authToken = loginRes.body.accessToken;
  });

  it('POST /api/v1/custom-reports should create report', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/custom-reports')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Q1 Report',
        reportType: 'quarterly',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Q1 Report');
  });

  it('GET /api/v1/custom-reports should list reports', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/custom-reports')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.reports)).toBe(true);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 3.6 Phase 6: Frontend Hook & Component

**Step 10: Create React hook**

```typescript
// frontend/src/hooks/useCustomReports.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';

export const useCustomReports = (workspaceId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['custom-reports', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/custom-reports', {
        params: { limit: 50 },
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (dto) =>
      apiClient.post('/api/v1/custom-reports', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['custom-reports', workspaceId],
      });
      toast({ title: 'Report created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating report',
        description: error.response?.data?.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/custom-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['custom-reports', workspaceId],
      });
      toast({ title: 'Report deleted' });
    },
  });

  return {
    reports: data?.reports || [],
    isLoading,
    error,
    createReport: createMutation.mutate,
    deleteReport: deleteMutation.mutate,
  };
};
```

**Step 11: Create React component**

```typescript
// frontend/src/components/custom-reports/CustomReportsList.tsx
'use client';

import { useState } from 'react';
import { useCustomReports } from '@/hooks/useCustomReports';
import { Button } from '@/components/ui/button';
import { CreateReportDialog } from './CreateReportDialog';

export function CustomReportsList({ workspaceId }: { workspaceId: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { reports, isLoading, createReport, deleteReport } =
    useCustomReports(workspaceId);

  const handleCreate = (dto: any) => {
    createReport(dto);
    setIsCreateOpen(false);
  };

  if (isLoading) return <div>Loading reports...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Custom Reports</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          Create Report
        </Button>
      </div>

      <CreateReportDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
      />

      <div className="grid gap-4">
        {reports.map((report: any) => (
          <div
            key={report.id}
            className="border rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-semibold">{report.name}</h3>
              <p className="text-sm text-gray-500">{report.reportType}</p>
            </div>
            <Button
              variant="destructive"
              onClick={() => deleteReport(report.id)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.7 Pre-Merge Checklist

Before opening a PR:

- [ ] Feature branch created from main
- [ ] Prisma migration created and tested locally
- [ ] Service logic has 100% test coverage
- [ ] Controller endpoints return correct status codes
- [ ] DTOs have validation (class-validator)
- [ ] All new functions have JSDoc comments
- [ ] Authorization checks in place (guards, ownership verification)
- [ ] Error handling follows standards (no swallowed errors)
- [ ] Logging added for business events and errors
- [ ] React hooks use React Query with proper invalidation
- [ ] Frontend components have loading/error states
- [ ] TypeScript strict mode compliant (no `any`)
- [ ] Database indices added for frequently-queried fields
- [ ] E2E tests pass locally
- [ ] CI pipeline passes (lint, typecheck, test, build)
- [ ] Updated CHANGELOG.md with new feature
- [ ] README updated if applicable
- [ ] Team code review completed (2+ approvals)

---

## 4. Database Engineering

### 4.1 Prisma Schema Patterns and Conventions

**File Structure:**

```
backend-node/
├── prisma/
│   ├── schema.prisma      (single source of truth)
│   ├── seed.ts            (data seeding)
│   └── migrations/        (immutable migration history)
│       ├── migration_lock.toml
│       └── 20260327_*/migration.sql
└── .env                   (DATABASE_URL, DIRECT_URL)
```

**Schema Conventions:**

```prisma
// 1. REQUIRED FIELDS for all models:
// - id (primary key)
// - createdAt (audit trail)
// - updatedAt (audit trail)

model Portfolio {
  id                String   @id @default(cuid())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // 2. Foreign keys immediately after
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // 3. Data fields
  name              String
  description       String?

  // 4. Relations at end
  assets            Asset[]
  valuations        Valuation[]

  // 5. Indexes for frequent queries
  @@index([organizationId])
  @@index([createdAt])
  @@unique([organizationId, name])
}

// 6. Enum models for constant values
enum ReportFrequency {
  DAILY
  WEEKLY
  MONTHLY
  QUARTERLY
  ANNUAL
}

model AlmReport {
  id                String        @id @default(cuid())
  frequency         ReportFrequency
}
```

**Never use:**
- `Int` for IDs (use `cuid()` or `uuid()`)
- `String` for timestamps (use `DateTime`)
- `Float` for monetary amounts (use `Decimal`)
- Nullable foreign keys without good reason

**Use Decimal for money:**

```prisma
model Asset {
  id              String    @id @default(cuid())
  nominalValue    Decimal   @db.Decimal(15, 2)  // $999,999,999.99
  marketValue     Decimal   @db.Decimal(15, 2)
  yieldPercent    Decimal   @db.Decimal(5, 4)   // 5.2345%
}
```

### 4.2 Migration Strategy

**Immutable migrations (forward-only):**

Every `prisma migrate dev` creates a timestamped SQL file that is never edited. This is the source of truth.

**Naming convention:**

```bash
npx prisma migrate dev --name add_portfolio_asset_relation
npx prisma migrate dev --name drop_deprecated_field
npx prisma migrate dev --name add_market_data_constraints
```

Generated file: `prisma/migrations/20260327172245_add_portfolio_asset_relation/migration.sql`

**Never edit migrations after creation.** If a migration has an error:

1. Delete the migration file
2. Fix the schema.prisma
3. Re-run `prisma migrate dev`

**Rollback strategy:**

```bash
# Development: drop everything and restart
npx prisma migrate reset

# Production: create a reverse migration
# Example: if migration adds a column, next migration drops it
```

**Apply migrations to environments:**

```bash
# Development
DATABASE_URL="postgresql://localhost:5432/cerniq_dev" \
  npx prisma migrate dev

# Staging
DATABASE_URL="postgresql://staging-db:5432/cerniq" \
  npx prisma migrate deploy

# Production (zero-downtime)
# Deploy code first, then:
DATABASE_URL="postgresql://prod-db:5432/cerniq" \
  npx prisma migrate deploy
```

### 4.3 Query Optimization Patterns

**Problem 1: N+1 Queries**

```typescript
// ❌ BAD: N+1 query (1 query for portfolios + N queries for assets)
const portfolios = await prisma.portfolio.findMany();
for (const p of portfolios) {
  p.assetCount = await prisma.asset.count({
    where: { portfolioId: p.id },
  });
}

// ✅ GOOD: Single query with count
const portfolios = await prisma.portfolio.findMany({
  select: {
    id: true,
    name: true,
    _count: {
      select: { assets: true },
    },
  },
});

// ✅ ALSO GOOD: Eager load relations
const portfolios = await prisma.portfolio.findMany({
  include: {
    assets: true,  // Loads all related assets
  },
});

// ✅ BEST for pagination: Use cursor-based pagination
const portfolios = await prisma.portfolio.findMany({
  take: 20,
  skip: 0,  // offset
  orderBy: { createdAt: 'desc' },
  include: { assets: { take: 5 } },  // Limit nested relations
});
```

**Problem 2: Large result sets**

```typescript
// ❌ BAD: Loads entire portfolio + all 50,000 assets into memory
const portfolio = await prisma.portfolio.findUnique({
  where: { id: 'xyz' },
  include: { assets: true },
});

// ✅ GOOD: Paginate large relations
const portfolio = await prisma.portfolio.findUnique({
  where: { id: 'xyz' },
  include: {
    assets: {
      take: 100,
      skip: pageNumber * 100,
      orderBy: { createdAt: 'desc' },
    },
  },
});

// ✅ ALSO GOOD: Use raw queries for batch operations
const result = await prisma.$queryRaw`
  UPDATE assets
  SET "marketValue" = "nominalValue" * 1.02
  WHERE "portfolioId" = ${portfolioId}
  RETURNING id;
`;
```

**Problem 3: Complex calculations**

```typescript
// ❌ BAD: Fetch all data and calculate in app
const portfolio = await prisma.portfolio.findUnique({
  where: { id: 'xyz' },
  include: { assets: true },
});
const total = portfolio.assets.reduce((sum, a) => sum + a.value, 0);

// ✅ GOOD: Let database do the work
const result = await prisma.$queryRaw`
  SELECT
    COALESCE(SUM("marketValue"), 0) as "totalValue",
    COUNT(*) as "assetCount",
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "yieldPercent") as "medianYield"
  FROM assets
  WHERE "portfolioId" = ${portfolioId};
`;
```

**Optimization checklist:**

- [ ] Use `.select()` to return only needed fields
- [ ] Use `.include()` only for small related sets (< 100 records)
- [ ] Use `.count()` for counts, not fetching all
- [ ] Paginate results with `.take()` and `.skip()`
- [ ] Use raw queries for batch updates/deletes
- [ ] Add database indices for WHERE clauses
- [ ] Use transactions for multi-step operations

### 4.4 Indexing Strategy

**Indices are created automatically on:**
- Primary keys (@id)
- Foreign keys (@relation)
- Unique fields (@unique)
- Fields with @db.Index

**Add explicit indices for:**

```prisma
model Asset {
  id                String   @id @default(cuid())
  portfolioId       String   @db.Uuid
  organizationId    String   @db.Uuid
  ticker            String
  marketValue       Decimal
  createdAt         DateTime @default(now())

  portfolio         Portfolio @relation(fields: [portfolioId], references: [id])

  // Frequently queried by:
  @@index([portfolioId])        // WHERE portfolioId = X
  @@index([organizationId])     // WHERE organizationId = X
  @@index([ticker])             // WHERE ticker = 'AAPL'
  @@index([createdAt])          // WHERE createdAt > X
  @@index([portfolioId, ticker]) // Composite: WHERE portfolioId = X AND ticker = Y
  @@index([organizationId, createdAt]) // Composite: WHERE organizationId = X ORDER BY createdAt
}

model HistoricalPrice {
  id                String   @id @default(cuid())
  ticker            String
  date              DateTime
  price             Decimal
  volume            BigInt

  // Frequently queried:
  @@index([ticker, date]) // WHERE ticker = X AND date = Y
  @@index([date])         // ORDER BY date DESC
}
```

**Never index everything.** Too many indices slow down writes.

**Index maintenance:**

```bash
# Check index usage (production)
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

# Drop unused indices
DROP INDEX IF EXISTS idx_name;
```

### 4.5 Connection Pooling Configuration

PostgreSQL connections are expensive. CERNIQ uses connection pooling via PgBouncer or direct PostgreSQL pool settings.

```typescript
// backend-node/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
          // Connection pool managed by Prisma
          // Direct URL bypasses PgBouncer for migrations
        },
      },
    });
  }

  async onModuleInit() {
    // Verify connection on startup
    await this.$connect();
    console.log('Prisma connected to database');
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

**Environment variables:**

```bash
# .env (development)
DATABASE_URL="postgresql://user:password@localhost:5432/cerniq?schema=public&connection_limit=5"

# Production (Railway, Vercel)
DATABASE_URL="postgresql://user:password@db-instance.railway.app:5432/cerniq?sslmode=require&connection_limit=20"
DIRECT_URL="postgresql://user:password@db-instance.railway.app:5432/cerniq?sslmode=require"  # For migrations
```

**Connection pool sizing:**

- Development: 5 connections
- Staging: 10 connections
- Production: 20 connections

`formula: num_cpus * 4` (typical for web apps)

### 4.6 Transaction Patterns

**ACID transactions for multi-step operations:**

```typescript
// ❌ BAD: Three separate queries, vulnerable to race conditions
async transferAssets(fromPortfolio: string, toPortfolio: string) {
  await prisma.asset.updateMany({
    where: { portfolioId: fromPortfolio },
    data: { portfolioId: toPortfolio },
  });

  await prisma.portfolio.update({
    where: { id: fromPortfolio },
    data: { assetCount: { decrement: 5 } },
  });

  await prisma.portfolio.update({
    where: { id: toPortfolio },
    data: { assetCount: { increment: 5 } },
  });
}

// ✅ GOOD: Single transaction
async transferAssets(fromPortfolio: string, toPortfolio: string) {
  return await prisma.$transaction(async (tx) => {
    // All operations below execute atomically
    const moved = await tx.asset.updateMany({
      where: { portfolioId: fromPortfolio },
      data: { portfolioId: toPortfolio },
    });

    await tx.portfolio.update({
      where: { id: fromPortfolio },
      data: { assetCount: { decrement: moved.count } },
    });

    await tx.portfolio.update({
      where: { id: toPortfolio },
      data: { assetCount: { increment: moved.count } },
    });

    return moved;
  });
}

// ✅ ALSO GOOD: Raw transaction for complex logic
async calculatePortfolioMetrics(portfolioId: string) {
  return await prisma.$transaction(async (tx) => {
    const assets = await tx.asset.findMany({
      where: { portfolioId },
    });

    const total = assets.reduce((sum, a) => sum + a.marketValue, 0);

    await tx.portfolio.update({
      where: { id: portfolioId },
      data: {
        totalValue: total,
        valuedAt: new Date(),
      },
    });

    return { portfolioId, totalValue: total };
  });
}
```

This completes Part 1 (Sections 1-4). I'll continue with Part 2 covering sections 5-8 in the next response.
# CERNIQ Enterprise Engineering Bible - Part 2

## 5. Authentication & Authorization Deep Dive

### 5.1 Full Authentication Flow Diagrams

**Email/Password Login Flow:**

```
User Input (email/password)
        ↓
POST /api/v1/auth/login
        ↓
Service: Hash password → Compare with bcrypt
        ↓
Password valid? ──NO──→ Return 401 + "Invalid credentials"
        ↓ YES
Generate JWT tokens:
  - Access token (24h): { userId, email, workspace, role }
  - Refresh token (7d): { userId, tokenVersion }
        ↓
Store refresh token in httpOnly cookie
        ↓
Return { accessToken, refreshToken, user }
        ↓
Client: Store accessToken in memory, refreshToken in cookie
```

**Magic Link Flow:**

```
User Input (email)
        ↓
POST /api/v1/auth/magic-link
        ↓
Generate code: crypto.randomBytes(32).toString('hex')
        ↓
Store in Redis: key=magic_link:code, value=userId, TTL=15min
        ↓
Send email: "Click here: /auth/magic-link/code"
        ↓
User clicks link
        ↓
GET /api/v1/auth/magic-link/:code
        ↓
Verify code exists in Redis
        ↓
Generate tokens (same as login)
        ↓
Delete Redis key (one-time use)
        ↓
Redirect to app with token in URL
```

**OAuth Flow (future):**

```
User clicks "Login with Google"
        ↓
Redirect to Google OAuth consent screen
        ↓
Google returns: code + state
        ↓
POST /api/v1/auth/oauth/google
        ↓
Exchange code for Google access token
        ↓
Fetch user info from Google
        ↓
Upsert user in database
        ↓
Generate CERNIQ tokens
        ↓
Return tokens
```

**API Key Authentication:**

```
Client: X-API-Key header with value: alm_xxxxxxxxxxxxxxxxxxxxxxxx
        ↓
POST /api/v1/resource
        ↓
Extract prefix: alm_xxxx (first 8 chars)
        ↓
Query: WHERE keyPrefix = 'alm_xxxx' AND organizationId = X
        ↓
Compare full key: SHA256(apiKey + pepper) == storedHash
        ↓
Key valid? ──NO──→ Return 401
        ↓ YES
Update lastUsedAt
        ↓
Proceed with request
```

### 5.2 JWT Token Lifecycle

**Access Token (24-hour expiration):**

```typescript
{
  "iss": "cerniq.com",
  "sub": "user_123",
  "aud": ["api"],
  "iat": 1711532400,
  "exp": 1711618800,  // +24 hours
  "email": "user@example.com",
  "role": "ANALYST",
  "workspaces": ["ws_1", "ws_2"],
  "activeWorkspace": "ws_1",
  "activeOrganization": "org_1"
}
```

**Refresh Token (7-day rotation):**

```typescript
// Stored in httpOnly cookie: cerniq_refresh_token
{
  "iss": "cerniq.com",
  "sub": "user_123",
  "iat": 1711532400,
  "exp": 1712137200,  // +7 days
  "tokenVersion": 5   // Incremented on each refresh to invalidate old tokens
}
```

**Token Refresh Flow:**

```typescript
// When access token expires:
// 1. Client detects 401 response
// 2. Calls POST /api/v1/auth/refresh
// 3. Backend reads refresh token from httpOnly cookie
// 4. Verifies signature and expiration
// 5. Increments tokenVersion (invalidates old token)
// 6. Returns new access token

// JWT verification with version checking:
@Injectable()
export class TokenService {
  constructor(private prisma: PrismaService) {}

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded as TokenPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    // Check token version (prevents reuse of old refresh tokens)
    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new UnauthorizedException('Token version mismatch - possible theft');
    }

    // Increment version for next refresh
    await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    return this.generateAccessToken(user);
  }

  generateAccessToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        workspaces: user.workspaces.map(w => w.id),
        activeWorkspace: user.activeWorkspaceId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}
```

### 5.3 Guard Hierarchy

Guards are middleware that check authorization before reaching the controller.

```
Request
  ↓
AuthGuard (Validates JWT or API key)
  ↓
OrganizationGuard (Validates user belongs to organization)
  ↓
WorkspaceGuard (Validates user belongs to workspace)
  ↓
RoleGuard (OWNER/ANALYST/VIEWER permissions)
  ↓
Controller
```

**AuthGuard implementation:**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Invalid Authorization scheme');
    }

    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

**AdminKeyGuard (system-level API access):**

```typescript
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const isValid = await this.apiKeyService.verify(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiKey = apiKey;
    return true;
  }
}
```

**RoleGuard (RBAC):**

```typescript
@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    // Get required roles from @Roles() decorator
    const requiredRoles = Reflect.getMetadata('roles', handler);

    if (!requiredRoles) return true; // No role requirement

    const userRole = request.user.role;

    const roleHierarchy = {
      'OWNER': 3,
      'ANALYST': 2,
      'VIEWER': 1,
    };

    const userLevel = roleHierarchy[userRole];
    const requiredLevel = Math.max(
      ...requiredRoles.map(r => roleHierarchy[r])
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Role ${userRole} insufficient. Required: ${requiredRoles.join(' or ')}`
      );
    }

    return true;
  }
}

// Usage:
@Controller('api/v1/portfolios')
export class PortfolioController {
  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('OWNER')
  async delete(@Param('id') id: string) {
    // Only OWNER can delete
  }
}

// Decorator:
export const Roles = (...roles: string[]) =>
  SetMetadata('roles', roles);
```

### 5.4 API Key Hashing Pattern

API keys are stored with a two-layer hashing strategy:

1. **Client-side:** User sees `alm_xxxxxxxxxxxxxxxxxxxxxxxx` (prefix + 24 random chars)
2. **Database:** Stores `SHA256(fullKey + pepper)` (unhashable)

```typescript
@Injectable()
export class ApiKeyService {
  private readonly pepper = process.env.API_KEY_PEPPER;

  // Generate a new API key
  async generate(organizationId: string, name: string) {
    const prefix = 'alm'; // or 'opt_', 'exe_' depending on scope
    const suffix = crypto.randomBytes(24).toString('hex');
    const fullKey = `${prefix}_${suffix}`;

    const hash = this.hashKey(fullKey);

    const storedKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        prefix: fullKey.substring(0, 8), // 'alm_xxxx'
        hash,
        expiresAt: null, // Optional expiration
      },
    });

    // Return full key ONLY at creation time
    return {
      id: storedKey.id,
      key: fullKey, // Never returned again
      prefix: storedKey.prefix,
      expiresAt: storedKey.expiresAt,
    };
  }

  // Verify a key during request
  async verify(providedKey: string): Promise<boolean> {
    const prefix = providedKey.substring(0, 8); // Extract 'alm_xxxx'

    const storedKey = await this.prisma.apiKey.findFirst({
      where: {
        prefix,
        expiresAt: { gt: new Date() }, // Not expired
      },
    });

    if (!storedKey) return false;

    const providedHash = this.hashKey(providedKey);
    return crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(storedKey.hash)
    );
  }

  private hashKey(key: string): string {
    return crypto
      .createHmac('sha256', this.pepper)
      .update(key)
      .digest('hex');
  }
}
```

### 5.5 RBAC Implementation

Role-Based Access Control with three levels: OWNER, ANALYST, VIEWER

```prisma
enum Role {
  OWNER       // Full access: create, read, update, delete, manage team
  ANALYST     // Read/write: create, read, update; no delete or team mgmt
  VIEWER      // Read-only: cannot modify anything
}

model WorkspaceMember {
  id          String @id @default(cuid())
  userId      String
  workspaceId String
  role        Role

  user        User @relation(fields: [userId], references: [id])
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@unique([userId, workspaceId])
}
```

**Permission matrix:**

```
                    OWNER  ANALYST  VIEWER
Create Portfolio      ✓      ✓        ✗
Read Portfolio        ✓      ✓        ✓
Update Portfolio      ✓      ✓        ✗
Delete Portfolio      ✓      ✗        ✗
Invite Team          ✓      ✗        ✗
Change Roles         ✓      ✗        ✗
View Reports         ✓      ✓        ✓
Edit Reports         ✓      ✓        ✗
Delete Reports       ✓      ✗        ✗
Manage Billing       ✓      ✗        ✗
```

**Checking permissions in service:**

```typescript
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async deletePortfolio(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const member = portfolio.workspace.members[0];
    if (!member || member.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only workspace owner can delete portfolios'
      );
    }

    return this.prisma.portfolio.delete({ where: { id } });
  }
}
```

### 5.6 Protecting a New Endpoint (Code Example)

**Scenario:** Create an endpoint to export portfolio to PDF. Only OWNER and ANALYST can access. OWNER sees all portfolios, ANALYST sees only their own.

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PortfolioExportService } from './portfolio-export.service';

@Controller('api/v1/portfolios')
@UseGuards(AuthGuard, RoleGuard)
export class PortfolioExportController {
  constructor(private exportService: PortfolioExportService) {}

  @Get(':id/export/pdf')
  @Roles('OWNER', 'ANALYST') // Endpoint requires OWNER or ANALYST
  async exportPdf(
    @Param('id') portfolioId: string,
    @CurrentUser() user: any,
  ) {
    // Service checks ownership/access
    return this.exportService.generatePdf(portfolioId, user);
  }
}

// Service handles fine-grained authorization:
@Injectable()
export class PortfolioExportService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async generatePdf(portfolioId: string, user: any) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: user.id },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const member = portfolio.workspace.members[0];
    if (!member) {
      throw new ForbiddenException('No access to this workspace');
    }

    // If user is ANALYST, they can only see their own portfolios
    // (Assuming createdById field exists)
    if (member.role === 'ANALYST' && portfolio.createdById !== user.id) {
      throw new ForbiddenException('Can only export own portfolios');
    }

    // OWNER can export any portfolio

    // Generate PDF
    const pdf = await this.pdfService.generatePortfolioPdf(portfolio);
    return pdf;
  }
}
```

---

## 6. Performance Engineering

### 6.1 Redis Caching Patterns

Redis caches frequently-accessed data with TTL (time-to-live) expiration.

**Cache key naming convention:**

```
[entity]:[id]:[version]
[entity]:[attribute]:[value]:[version]

Examples:
portfolio:p_123:v1
portfolio:organization:org_456:v1
user:email:john@example.com:v1
alm_result:p_789:20260327:v1
market_data:ticker:AAPL:v1
```

**Basic caching pattern:**

```typescript
@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getPortfolio(id: string): Promise<Portfolio> {
    const cacheKey = `portfolio:${id}:v1`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit', { cacheKey });
      return JSON.parse(cached);
    }

    // Fetch from database
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(portfolio), 'EX', 3600);

    return portfolio;
  }

  async updatePortfolio(id: string, data: any) {
    const portfolio = await this.prisma.portfolio.update({
      where: { id },
      data,
    });

    // Invalidate cache
    const cacheKey = `portfolio:${id}:v1`;
    await this.redis.del(cacheKey);

    return portfolio;
  }
}
```

**Pattern: Cache lists with versioning:**

```typescript
async getOrganizationPortfolios(organizationId: string): Promise<Portfolio[]> {
  const cacheKey = `portfolio:organization:${organizationId}:v1`;

  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const portfolios = await this.prisma.portfolio.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  // Cache for 5 minutes
  await this.redis.set(
    cacheKey,
    JSON.stringify(portfolios),
    'EX',
    300
  );

  return portfolios;
}

// When creating a new portfolio:
async createPortfolio(organizationId: string, data: any) {
  const portfolio = await this.prisma.portfolio.create({
    data: { ...data, organizationId },
  });

  // Invalidate the list cache for this organization
  const listCacheKey = `portfolio:organization:${organizationId}:v1`;
  await this.redis.del(listCacheKey);

  // If using versioning, increment the version
  // Next request will generate new cache key: v2
  await this.redis.incr(`cache_version:portfolio:organization:${organizationId}`);

  return portfolio;
}
```

**TTL Strategy:**

```
Entity                 TTL       Rationale
─────────────────────────────────────────────────
User profile          5 minutes  Changes infrequently
Portfolio             10 minutes Accessed frequently
ALM results           60 minutes Heavy calculation
Market data           1 minute   Updates frequently
Risk metrics          5 minutes  Depends on market data
Lists (portfolios)    5 minutes  Invalidated on create
User permissions      10 minutes Changes rarely
```

**Invalidation patterns:**

```typescript
// 1. Pattern-based invalidation
async invalidatePortfolioCache(portfolioId: string) {
  // Delete specific portfolio
  await this.redis.del(`portfolio:${portfolioId}:v1`);

  // Delete lists containing this portfolio
  // (Requires tracking which lists contain which items)
  const relatedLists = await this.redis.keys(`portfolio:*:v1`);
  for (const key of relatedLists) {
    await this.redis.del(key);
  }
}

// 2. Versioning-based (preferred)
async invalidatePortfolioCache(portfolioId: string) {
  // Increment version number → all old cache keys become invalid
  const version = await this.redis.incr(
    `cache_version:portfolio:${portfolioId}`
  );

  // New requests use new version:
  // cacheKey = `portfolio:${portfolioId}:v${version}`
  // This avoids the N+1 deletion problem
}

// 3. Set-based invalidation
// Store set of cache keys affected by entity
async createPortfolio(organizationId: string, data: any) {
  const portfolio = await this.prisma.portfolio.create({
    data: { ...data, organizationId },
  });

  // Track cache keys to invalidate
  const invalidateKeys = [
    `portfolio:organization:${organizationId}:v1`,
    `metrics:organization:${organizationId}:v1`,
    `dashboard:user:${userId}:v1`,
  ];

  await this.redis.del(...invalidateKeys);
  return portfolio;
}
```

### 6.2 Database Query Benchmarks and Targets

Performance targets by operation type:

```
Operation                              Target    Acceptable   Unacceptable
──────────────────────────────────────────────────────────────────────────
Single record fetch (GET /portfolios/:id)      <10ms    <20ms     >50ms
List query (GET /portfolios, limit 20)         <30ms    <50ms     >100ms
Create (POST /portfolio)                       <20ms    <50ms     >100ms
Update (PATCH /portfolio/:id)                  <20ms    <50ms     >100ms
Delete (DELETE /portfolio/:id)                 <10ms    <20ms     >50ms
ALM calculation (50-100 assets)                <50ms    <100ms    >200ms
Stress test (5 scenarios)                      <500ms   <1000ms   >2000ms
PDF generation (14-page report)                <2s      <5s       >10s
Maturity analysis (100+ buckets)               <30ms    <50ms     >100ms
Risk metric calculation                        <50ms    <100ms    >200ms
```

**Benchmark testing:**

```typescript
import { performance } from 'perf_hooks';

async function benchmarkQuery(name: string, fn: () => Promise<any>) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`${name}: ${duration.toFixed(2)}ms`);

  if (duration > 100) {
    this.logger.warn(`Slow query detected`, {
      name,
      duration,
      threshold: 100,
    });
  }

  return result;
}

// Usage:
const portfolio = await benchmarkQuery(
  'Get portfolio by ID',
  () => this.getPortfolio(portfolioId)
);
```

### 6.3 Response Time Budgets by Endpoint Category

Frontend → Backend network + processing time should not exceed:

```
Endpoint Category                         Budget
─────────────────────────────────────────────────
RESTful CRUD operations                   200ms
List/search operations                    300ms
ALM calculations                          500ms
Report generation (async job)             5s+
PDF export (background)                   30s+
Real-time dashboards (WebSocket)          50ms
GraphQL queries                           300ms
File uploads                              5s
Batch operations                          10s
```

### 6.4 N+1 Query Detection and Prevention

**Problem: Fetching related data in loops**

```typescript
// ❌ BAD: This causes N+1 queries
async getPortfoliosWithAssets(organizationId: string) {
  const portfolios = await this.prisma.portfolio.findMany({
    where: { organizationId },
  });

  // This loop executes 1 query per portfolio (N+1)
  for (const portfolio of portfolios) {
    portfolio.assets = await this.prisma.asset.findMany({
      where: { portfolioId: portfolio.id },
    });
  }

  return portfolios;
}
// Queries executed: 1 (list) + N (assets) = N+1
```

**Solution 1: Eager loading with `include`**

```typescript
// ✅ GOOD: 1 query with eager loading
async getPortfoliosWithAssets(organizationId: string) {
  return this.prisma.portfolio.findMany({
    where: { organizationId },
    include: { assets: true },
  });
}
// Queries executed: 1
```

**Solution 2: Separate queries (if related data is large)**

```typescript
// ✅ GOOD: 2 queries, better for large datasets
async getPortfoliosWithAssets(organizationId: string) {
  const [portfolios, assets] = await Promise.all([
    this.prisma.portfolio.findMany({
      where: { organizationId },
    }),
    this.prisma.asset.findMany({
      where: { portfolio: { organizationId } },
    }),
  ]);

  // Merge in memory
  const map = new Map(assets.map(a => [a.portfolioId, a]));
  return portfolios.map(p => ({
    ...p,
    assets: map.get(p.id) || [],
  }));
}
// Queries executed: 2 (parallel)
```

**Solution 3: Raw SQL for complex joins**

```typescript
// ✅ BEST for complex queries
async getPortfoliosWithMetrics(organizationId: string) {
  return this.prisma.$queryRaw`
    SELECT
      p.id,
      p.name,
      COUNT(a.id) as "assetCount",
      COALESCE(SUM(a."marketValue"), 0) as "totalValue"
    FROM Portfolio p
    LEFT JOIN Asset a ON p.id = a."portfolioId"
    WHERE p."organizationId" = ${organizationId}
    GROUP BY p.id, p.name
  `;
}
// Queries executed: 1
```

### 6.5 Memory Management for Large PDF Generation

Generating a 14-page PDF with charts can consume significant memory.

```typescript
@Injectable()
export class PdfService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger,
  ) {}

  async generatePortfolioPdf(
    portfolioId: string,
    userId: string,
  ): Promise<Buffer> {
    const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

    try {
      // 1. Stream data from database instead of loading all at once
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          assets: {
            take: 100, // Paginate large relations
            select: { id: true, ticker: true, value: true },
          },
        },
      });

      // 2. Create PDF with streaming
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // 3. Add content incrementally (not all at once)
      this.addPortfolioHeader(doc, portfolio);
      this.addAssetTable(doc, portfolio.assets);
      this.addCharts(doc, portfolio); // Server-side chart generation
      this.addFooter(doc);

      doc.end();

      // 4. Wait for all data
      await new Promise((resolve, reject) => {
        doc.on('finish', resolve);
        doc.on('error', reject);
      });

      const pdf = Buffer.concat(chunks);

      const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
      this.logger.log('PDF generated', {
        portfolioId,
        sizeKb: pdf.length / 1024,
        memoryDeltaMb: (endMem - startMem).toFixed(2),
      });

      return pdf;
    } catch (error) {
      this.logger.error('PDF generation failed', { portfolioId, error });
      throw error;
    }
  }

  private addCharts(doc: PDFDocument, portfolio: any) {
    // Use canvas to generate charts server-side
    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext('2d');

    // Draw chart
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(0, 0, 400, 300);

    const chartImage = canvas.toDataURL('image/png');
    doc.image(chartImage, 50, 300, { width: 400 });
  }
}
```

### 6.6 Rate Limiting Architecture

**Global + per-endpoint rate limiting:**

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 1 minute window
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
})
export class AppModule {}

// Controller: Apply global limit
@Controller('api/v1/portfolios')
@UseGuards(AuthGuard)
export class PortfolioController {
  @Get()
  @Throttle({ global: { limit: 100, ttl: 60000 } })
  async list() {
    // Up to 100 requests per minute
  }

  @Post(':id/calculate-alm')
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  async calculateAlm() {
    // More restrictive: 10 calculations per minute
  }
}

// Custom rate limiting per user (not just IP):
@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use user ID instead of IP for authenticated requests
    return req['user']?.id || req.ip;
  }
}

// Usage:
@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @UseGuards(CustomThrottleGuard)
  @Throttle({ global: { limit: 5, ttl: 60000 } })
  async login() {
    // Brute force protection: 5 login attempts per minute per user
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Test Patterns for NestJS Services

**Template: Mock Prisma and Redis**

```typescript
// portfolio.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prisma: PrismaService;
  let redis: RedisService;

  // Mock implementations
  const mockPrisma = {
    portfolio: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('createPortfolio', () => {
    it('should create a portfolio and invalidate cache', async () => {
      const dto = {
        organizationId: 'org_123',
        name: 'Q1 2026',
      };

      const created = {
        id: 'p_123',
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.portfolio.create.mockResolvedValue(created);

      const result = await service.createPortfolio(dto);

      expect(result).toEqual(created);
      expect(mockPrisma.portfolio.create).toHaveBeenCalledWith({
        data: dto,
      });

      // Cache invalidation was called
      expect(mockRedis.del).toHaveBeenCalledWith(
        `portfolio:organization:org_123:v1`
      );
    });

    it('should throw error if organization does not exist', async () => {
      const dto = {
        organizationId: 'invalid',
        name: 'Portfolio',
      };

      mockPrisma.portfolio.create.mockRejectedValue(
        new Error('Foreign key violation')
      );

      await expect(service.createPortfolio(dto)).rejects.toThrow();
    });
  });

  describe('getPortfolio', () => {
    it('should return cached portfolio if available', async () => {
      const portfolio = { id: 'p_123', name: 'Q1 2026' };

      mockRedis.get.mockResolvedValue(JSON.stringify(portfolio));

      const result = await service.getPortfolio('p_123');

      expect(result).toEqual(portfolio);
      expect(mockPrisma.portfolio.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache if not cached', async () => {
      const portfolio = { id: 'p_123', name: 'Q1 2026' };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.portfolio.findUnique.mockResolvedValue(portfolio);

      const result = await service.getPortfolio('p_123');

      expect(result).toEqual(portfolio);
      expect(mockPrisma.portfolio.findUnique).toHaveBeenCalledWith({
        where: { id: 'p_123' },
      });
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if portfolio does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.portfolio.findUnique.mockResolvedValue(null);

      await expect(service.getPortfolio('invalid')).rejects.toThrow(
        'Portfolio not found'
      );
    });
  });

  describe('updatePortfolio', () => {
    it('should update portfolio and invalidate cache', async () => {
      const updated = {
        id: 'p_123',
        name: 'Q1 2026 Updated',
      };

      mockPrisma.portfolio.update.mockResolvedValue(updated);

      const result = await service.updatePortfolio('p_123', { name: 'Q1 2026 Updated' });

      expect(result).toEqual(updated);
      expect(mockRedis.del).toHaveBeenCalledWith('portfolio:p_123:v1');
    });

    it('should validate user ownership before update', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p_123',
        ownerId: 'user_456',
      });

      await expect(
        service.updatePortfolio('p_123', {}, 'user_123')
      ).rejects.toThrow('Not authorized');

      expect(mockPrisma.portfolio.update).not.toHaveBeenCalled();
    });
  });
});
```

### 7.2 Integration Test Patterns

```typescript
// portfolio.service.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('PortfolioService (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clear database before each test
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Portfolio" CASCADE');
  });

  it('should create and retrieve portfolio', async () => {
    // Create organization first
    const org = await prisma.organization.create({
      data: {
        name: 'Test Coop',
        type: 'cooperativa',
      },
    });

    // Create portfolio
    const portfolio = await prisma.portfolio.create({
      data: {
        organizationId: org.id,
        name: 'Q1 Portfolio',
      },
    });

    // Retrieve and verify
    const found = await prisma.portfolio.findUnique({
      where: { id: portfolio.id },
    });

    expect(found).toBeDefined();
    expect(found.name).toBe('Q1 Portfolio');
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 7.3 E2E Test Coverage (Playwright Specs)

CERNIQ uses Playwright for E2E tests. Five main spec files:

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login with email and password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'Test1234!');
    await page.click('button:has-text("Sign In")');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should refresh token after expiration', async ({ page }) => {
    // Login
    await page.goto('/login');
    // ... login steps ...

    // Wait for access token to expire (mock time)
    // Try to access protected route
    // Should auto-refresh and succeed
  });
});

// e2e/portfolios.spec.ts
test.describe('Portfolio Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    // ... login ...
  });

  test('should create and display portfolio', async ({ page }) => {
    await page.goto('/portfolios');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder="Portfolio name"]', 'Q1 2026');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Q1 2026')).toBeVisible();
  });

  test('should upload assets and display in table', async ({ page }) => {
    // Create portfolio first
    // Upload CSV with assets
    // Verify assets appear in table
  });
});

// e2e/alm.spec.ts
test.describe('ALM Calculations', () => {
  test('should calculate ALM and display results', async ({ page }) => {
    // Navigate to portfolio
    // Click "Calculate ALM"
    // Verify calculation completes
    // Verify results displayed
  });

  test('should run stress test scenario', async ({ page }) => {
    // Run ALM calculation
    // Click "Stress Test"
    // Set interest rate shift (+50bps)
    // Verify results updated
  });
});

// e2e/reports.spec.ts
test.describe('Report Generation', () => {
  test('should export portfolio to PDF', async ({ page }) => {
    // Navigate to portfolio
    // Click "Export PDF"
    // Verify download started
  });

  test('should bilingual report (ES/EN)', async ({ page }) => {
    // Export PDF
    // Verify English section exists
    // Verify Spanish section exists
  });
});

// e2e/billing.spec.ts
test.describe('Billing & Subscriptions', () => {
  test('should upgrade subscription', async ({ page }) => {
    // Navigate to settings
    // Click upgrade
    // Verify Stripe checkout
    // Verify subscription active after payment
  });
});
```

### 7.4 Test Data Seeding Strategy

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Clear existing data (development only)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "_prisma_migrations" CASCADE');
  }

  // 2. Create test organizations
  const org1 = await prisma.organization.create({
    data: {
      name: 'Test Cooperativa 1',
      type: 'cooperativa',
      registrationNumber: 'COOP-001',
      members: {
        create: [
          {
            userId: 'user_owner_1',
            role: 'OWNER',
          },
          {
            userId: 'user_analyst_1',
            role: 'ANALYST',
          },
        ],
      },
    },
  });

  // 3. Create workspaces
  const workspace1 = await prisma.workspace.create({
    data: {
      organizationId: org1.id,
      name: 'Q1 2026 Analysis',
    },
  });

  // 4. Create portfolios
  const portfolio1 = await prisma.portfolio.create({
    data: {
      organizationId: org1.id,
      workspaceId: workspace1.id,
      name: 'Investment Portfolio',
      description: 'Main investment portfolio',
    },
  });

  // 5. Create sample assets
  const assets = [];
  for (let i = 0; i < 50; i++) {
    const asset = await prisma.asset.create({
      data: {
        portfolioId: portfolio1.id,
        ticker: `TICKER${i}`,
        quantity: Math.floor(Math.random() * 1000),
        nominalValue: (Math.random() * 100000).toFixed(2),
        marketValue: (Math.random() * 110000).toFixed(2),
      },
    });
    assets.push(asset);
  }

  console.log(`Seeded ${assets.length} assets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

// Run:
// npx prisma db seed
```

### 7.5 Coverage Targets

```
Module                Coverage Target
─────────────────────────────────────
ALM calculation           > 85%
Risk metrics              > 85%
Services (business logic) > 80%
Controllers (HTTP)        > 70%
Guards & interceptors     > 75%
Utilities & helpers       > 70%
Overall                   > 80%
```

### 7.6 ALM Calculation Test Example

```typescript
describe('AlmService - Calculation', () => {
  let service: AlmService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // Setup...
  });

  describe('calculateMaturityGap', () => {
    it('should calculate correct gap for assets', async () => {
      // Create test assets with known maturity dates
      const assets = [
        { id: 'a1', maturityDate: in 30 days, value: 100,000 },
        { id: 'a2', maturityDate: in 90 days, value: 200,000 },
        { id: 'a3', maturityDate: in 365 days, value: 300,000 },
      ];

      const gaps = await service.calculateMaturityGap(
        portfolioId,
        ['0-30d', '31-90d', '91-365d']
      );

      expect(gaps['0-30d']).toBe(100000);
      expect(gaps['31-90d']).toBe(200000);
      expect(gaps['91-365d']).toBe(300000);
    });

    it('should handle empty portfolio', async () => {
      const portfolio = await createEmptyPortfolio();

      const gaps = await service.calculateMaturityGap(portfolio.id, [
        '0-30d',
      ]);

      expect(gaps['0-30d']).toBe(0);
    });
  });

  describe('calculateNetInterestMargin', () => {
    it('should calculate NIM correctly', async () => {
      const portfolio = await createPortfolioWithAssets([
        // High-yield bonds: 5% yield
        { type: 'BOND', yield: 0.05, value: 500000 },
        // Savings accounts: 1% cost
        { type: 'LIABILITY', yield: -0.01, value: 300000 },
      ]);

      const nim = await service.calculateNetInterestMargin(portfolio.id);

      // (500k * 5% - 300k * 1%) / 800k = 7%
      expect(nim).toBeCloseTo(0.07, 4);
    });
  });
});
```

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions Workflows

**Main workflow: test → typecheck → lint → build → deploy**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: cerniq_test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          cd backend-node
          npm ci

      - name: Setup database
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/cerniq_test
        run: |
          cd backend-node
          npx prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/cerniq_test
        run: |
          cd backend-node
          npm run test:cov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend-node/coverage/lcov.info

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: |
          cd backend-node
          npm ci

      - name: Run ESLint
        run: |
          cd backend-node
          npm run lint

      - name: Check formatting
        run: |
          cd backend-node
          npm run format:check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: |
          cd backend-node
          npm ci

      - name: TypeScript strict check
        run: |
          cd backend-node
          npm run typecheck

  build:
    runs-on: ubuntu-latest
    needs: [test, lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: |
          cd backend-node
          npm ci

      - name: Build
        run: |
          cd backend-node
          npm run build

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: backend-node/dist

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
          SERVICE_ID: ${{ secrets.RAILWAY_SERVICE_ID }}
        run: |
          npm install -g @railway/cli
          railway deploy --service $SERVICE_ID

      - name: Deploy frontend to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          cd frontend
          npm ci
          npx vercel --prod --token $VERCEL_TOKEN
```

**Frontend-specific workflow:**

```yaml
# .github/workflows/frontend.yml
name: Frontend CI/CD

on:
  push:
    paths:
      - 'frontend/**'
    branches: [main, develop]
  pull_request:
    paths:
      - 'frontend/**'

jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

      - name: Upload to Vercel
        if: github.ref == 'refs/heads/main'
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: npx vercel --prod --token $VERCEL_TOKEN
```

### 8.2 Deployment Pipeline

**Railway Backend Deployment:**

```bash
# Step 1: Build Docker image
docker build -t cerniq-backend:latest \
  -f backend-node/Dockerfile \
  .

# Step 2: Push to Railway
railway login
railway service select cerniq-backend
railway deploy

# Step 3: Run migrations
railway run npx prisma migrate deploy

# Step 4: Health check
curl https://api.cerniq.com/health
```

**Dockerfile:**

```dockerfile
# backend-node/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**Vercel Frontend Deployment:**

```json
// frontend/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "cleanUrls": true,
  "trailingSlash": false,
  "env": {
    "NEXT_PUBLIC_API_URL": "@api_url",
    "NEXT_PUBLIC_STRIPE_KEY": "@stripe_key"
  }
}
```

### 8.3 Environment Variable Management

```bash
# .github/secrets (set in GitHub Settings)
DATABASE_URL           # Production database URL
DIRECT_URL            # Bypass PgBouncer for migrations
JWT_SECRET            # Asymmetric key for signing
REFRESH_SECRET        # Different key for refresh tokens
API_KEY_PEPPER        # Salt for API key hashing
STRIPE_SECRET_KEY     # Stripe payment processing
STRIPE_WEBHOOK_SECRET # Webhook signature verification
RESEND_API_KEY        # Email service
SENTRY_DSN            # Error tracking
RAILWAY_TOKEN         # Railway deployment auth
VERCEL_TOKEN          # Vercel deployment auth

# .env.local (development)
DATABASE_URL="postgresql://localhost:5432/cerniq"
DIRECT_URL="postgresql://localhost:5432/cerniq"
JWT_SECRET="dev-secret-key"
# ... etc
```

### 8.4 Database Migration in Production (Zero-Downtime)

**Strategy: Expand-Contract Pattern**

```
Step 1: EXPAND (backward compatible)
  - Add new column
  - Deploy code that writes to both old + new
  - Backfill existing data
  - Verify data consistency

Step 2: CONTRACT (remove old)
  - Deploy code that only reads from new column
  - Drop old column (in next migration)
```

**Example: Add billing_status field**

```sql
-- Migration 1: Expand (backward compatible)
ALTER TABLE "Organization"
ADD COLUMN "billingStatus" VARCHAR(50) DEFAULT 'active';

CREATE INDEX "idx_billing_status" ON "Organization" ("billingStatus");
```

```typescript
// Service: Write to both columns during transition
async updateOrganization(id: string, data: any) {
  return this.prisma.organization.update({
    where: { id },
    data: {
      ...data,
      billingStatus: data.billingStatus,
      status: data.billingStatus, // Deprecated, but still updated for safety
    },
  });
}
```

```sql
-- Migration 2: Contract (after code deployed to production)
ALTER TABLE "Organization"
DROP COLUMN "status";
```

### 8.5 Rollback Procedures

**If deployment fails:**

```bash
# Option 1: Rollback code to previous commit
git revert HEAD~0  # Create new commit with previous state
git push
# GitHub Actions will deploy reverted code

# Option 2: Rollback database (if migration issue)
npx prisma migrate resolve --rolled-back 20260327172245_add_field

# Option 3: Emergency: Restore from backup
# Contact DevOps, restore snapshot
```

This completes Part 2 (Sections 5-8). Part 3 will cover sections 9-14 in the final response.
# CERNIQ Enterprise Engineering Bible - Part 3

## 9. Error Handling & Observability

### 9.1 Global Exception Filter Architecture

Every unhandled error is caught, logged, and transformed into a structured response.

```typescript
// backend-node/src/common/filters/exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'object') {
        code = errorResponse['code'] || exception.name;
        message = errorResponse['message'] || exception.message;
        details = errorResponse['details'];
      } else {
        message = errorResponse as string;
      }
    } else if (exception instanceof Error) {
      // Handle generic Error
      message = exception.message;
      code = exception.name;

      // Log stack trace for unexpected errors
      this.logger.error('Unexpected error', {
        message: exception.message,
        stack: exception.stack,
        path: request.path,
      });
    }

    const errorResponse = {
      code,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      ...(details && { details }),
    };

    // Report to Sentry for errors >= 500
    if (status >= 500) {
      Sentry.captureException(exception, {
        contexts: {
          request: {
            method: request.method,
            path: request.path,
            headers: request.headers,
          },
        },
      });
    }

    response.status(status).json(errorResponse);
  }
}

// Register in main.ts:
app.useGlobalFilters(new GlobalExceptionFilter());
```

### 9.2 Error Response Format

**Every API error response follows this format:**

```json
{
  "code": "UNIQUE_ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2026-03-27T14:32:00Z",
  "path": "/api/v1/portfolios/xyz",
  "details": {
    "field": "portfolio_id",
    "reason": "Portfolio with this ID not found"
  }
}
```

**Error codes by category:**

```
Auth errors:
  INVALID_CREDENTIALS        (401)
  TOKEN_EXPIRED              (401)
  INVALID_API_KEY            (401)
  INSUFFICIENT_PERMISSIONS   (403)
  WORKSPACE_ACCESS_DENIED    (403)

Validation errors:
  INVALID_REQUEST_BODY       (400)
  MISSING_REQUIRED_FIELD     (400)
  INVALID_PORTFOLIO_ID       (400)
  INVALID_DATE_FORMAT        (400)

Resource errors:
  PORTFOLIO_NOT_FOUND        (404)
  ASSET_NOT_FOUND            (404)
  ORGANIZATION_NOT_FOUND     (404)
  WORKSPACE_NOT_FOUND        (404)

Conflict errors:
  PORTFOLIO_ALREADY_EXISTS   (409)
  DUPLICATE_ASSET            (409)
  CONCURRENT_MODIFICATION    (409)

Rate limiting:
  RATE_LIMIT_EXCEEDED        (429)
  TOO_MANY_REQUESTS          (429)

Server errors:
  DATABASE_ERROR             (500)
  CALCULATION_FAILED         (500)
  PDF_GENERATION_FAILED      (500)
  INTERNAL_SERVER_ERROR      (500)
```

### 9.3 Sentry Error Tracking Integration

```typescript
// backend-node/src/main.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      nodeProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  const app = await NestFactory.create(AppModule);

  // Use Sentry middleware for transaction tracking
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());

  await app.listen(3001);
}

bootstrap();
```

**Sentry in services:**

```typescript
@Injectable()
export class AlmService {
  async calculateAlm(portfolioId: string) {
    const transaction = Sentry.startTransaction({
      op: 'alm.calculate',
      name: 'Calculate ALM',
    });

    try {
      const result = await this._calculateInternal(portfolioId);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('error');
      Sentry.captureException(error, {
        contexts: {
          alm: {
            portfolioId,
            calculationType: 'full_calculation',
          },
        },
        level: 'error',
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

### 9.4 OpenTelemetry Distributed Tracing

```typescript
// backend-node/src/tracing.ts
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
});

sdk.start();

// Spans are automatically created for:
// - HTTP requests/responses
// - Database queries (Prisma)
// - Redis operations
// - Timers and promises

export default sdk;
```

**Manual span creation:**

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('cerniq-backend');

async function complexCalculation() {
  const span = tracer.startSpan('complex_calculation');

  try {
    const childSpan = tracer.startSpan('data_fetch', { parent: span });
    const data = await fetchData();
    childSpan.end();

    const processSpan = tracer.startSpan('process_data', { parent: span });
    const result = processData(data);
    processSpan.end();

    return result;
  } finally {
    span.end();
  }
}
```

### 9.5 Pino Structured Logging

```typescript
// backend-node/src/logger/logger.service.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});

// Usage:
import { Logger } from '@nestjs/common';

@Injectable()
export class PortfolioService {
  private logger = new Logger(PortfolioService.name);

  async createPortfolio(organizationId: string, dto: CreatePortfolioDto) {
    const correlationId = v4();

    this.logger.log('Creating portfolio', {
      correlationId,
      organizationId,
      portfolioName: dto.name,
    });

    const portfolio = await this.prisma.portfolio.create({
      data: { ...dto, organizationId },
    });

    this.logger.log('Portfolio created', {
      correlationId,
      portfolioId: portfolio.id,
      duration: Date.now() - startTime,
    });

    return portfolio;
  }
}
```

**Log levels by severity:**

```
DEBUG: Detailed execution flow, variable values
  portfolio_service.ts:
    "Fetching portfolio from database"
    "Setting cache TTL to 600 seconds"

INFO: Business events (creates, updates, calculations)
  portfolio_service.ts:
    "Portfolio created successfully"
    "ALM calculation started"
    "Risk metrics updated"

WARN: Recoverable issues (retries, degraded state)
  portfolio_service.ts:
    "Database query slow: 250ms (expected <50ms)"
    "Redis connection failed, using database fallback"
    "Retry attempt 2 of 3"

ERROR: Unrecoverable failures (crashes, exceptions)
  portfolio_service.ts:
    "Failed to create portfolio: database error"
    "Calculation timed out after 5 seconds"
    "Payment processing failed"

FATAL: System-level failures requiring intervention
  main.ts:
    "Database connection lost"
    "Out of memory - emergency shutdown"
```

### 9.6 Health Check Architecture

```typescript
// backend-node/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  /**
   * GET /health
   * Returns 200 if service is running
   * Used by Kubernetes, load balancers
   */
  @Get()
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /ready
   * Returns 200 if service is ready to handle traffic
   * Checks dependencies (DB, Redis, external services)
   */
  @Get('ready')
  async readiness() {
    const checks = await this.health.checkAll();

    return {
      status: checks.every(c => c.healthy) ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/detailed
   * Detailed health check with metrics
   */
  @Get('detailed')
  async detailed() {
    return {
      service: 'cerniq-backend',
      version: process.env.VERSION || 'unknown',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: await this.health.checkDatabase(),
      redis: await this.health.checkRedis(),
      timestamp: new Date().toISOString(),
    };
  }
}

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async checkAll() {
    return Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
    ]);
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database', healthy: true, latencyMs: null };
    } catch (error) {
      return { name: 'database', healthy: false, error: error.message };
    }
  }

  async checkRedis() {
    try {
      await this.redis.ping();
      return { name: 'redis', healthy: true };
    } catch (error) {
      return { name: 'redis', healthy: false, error: error.message };
    }
  }

  async checkExternalServices() {
    // Check Stripe, Resend, etc.
    return { name: 'external', healthy: true };
  }
}
```

### 9.7 Alert Thresholds and On-Call Runbook

```yaml
# monitoring/alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    window: 5m
    severity: critical
    action: page_oncall
    runbook: "https://docs.cerniq.com/runbooks/high-error-rate"

  - name: DatabaseResponseSlow
    condition: db_query_p99 > 200ms
    window: 10m
    severity: warning
    action: alert_slack
    runbook: "https://docs.cerniq.com/runbooks/slow-db"

  - name: RedisCacheMiss
    condition: cache_miss_ratio > 30%
    window: 15m
    severity: warning
    action: alert_slack

  - name: OutOfMemory
    condition: memory_usage > 90%
    window: 1m
    severity: critical
    action: page_oncall

  - name: StripeWebhookFailure
    condition: webhook_error_count > 10
    window: 5m
    severity: critical
    action: page_oncall

  - name: PDFGenerationTimeout
    condition: pdf_timeout_count > 5
    window: 10m
    severity: warning
    action: alert_slack
```

---

## 10. Security Engineering

### 10.1 CORS Configuration

CERNIQ accepts requests from:
- Production: `https://cerniq.com`, `https://*.cerniq.com`
- Staging: `https://staging.cerniq.com`
- Vercel previews: `https://*.vercel.app`
- Development: `http://localhost:3000`

```typescript
// backend-node/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        /^https:\/\/cerniq\.com$/,
        /^https:\/\/[\w-]+\.cerniq\.com$/,
        /^https:\/\/[\w-]+\.vercel\.app$/,
        /^http:\/\/localhost:3000$/,
      ];

      const isAllowed = allowedOrigins.some(pattern =>
        pattern.test(origin || '')
      );

      if (isAllowed || !origin) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Correlation-ID',
    ],
  });

  await app.listen(3001);
}

bootstrap();
```

### 10.2 Rate Limiting Implementation

```typescript
// backend-node/src/app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 5,
      },
      {
        name: 'calculation',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
})
export class AppModule {}

// Controllers:
@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    // Max 5 login attempts per minute per IP
  }
}

@Controller('api/v1/alm')
export class AlmController {
  @Post('calculate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ calculation: { limit: 10, ttl: 60000 } })
  async calculate(@Body() dto: CalculateAlmDto) {
    // Max 10 calculations per minute per user
  }
}
```

### 10.3 AES-256-GCM Encryption Service

Sensitive data (SSN, account numbers, etc.) is encrypted at rest.

```typescript
// backend-node/src/crypto/encryption.service.ts
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: Buffer;

  constructor() {
    // Load key from environment (must be 32 bytes for AES-256)
    this.encryptionKey = Buffer.from(
      process.env.ENCRYPTION_KEY,
      'hex'
    );

    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns: iv::authTag::ciphertext (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16); // IV unique per encryption
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv::authTag::ciphertext
    return `${iv.toString('hex')}::${authTag.toString('hex')}::${ciphertext}`;
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, ciphertext] = encryptedData.split('::');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv
    );
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}

// Usage:
@Injectable()
export class UserService {
  constructor(private encryption: EncryptionService) {}

  async createUser(email: string, ssn: string) {
    // Encrypt SSN before storing
    const encryptedSsn = this.encryption.encrypt(ssn);

    return this.prisma.user.create({
      data: {
        email,
        ssn: encryptedSsn,
      },
    });
  }

  async getUserSsn(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Decrypt SSN when needed
    return this.encryption.decrypt(user.ssn);
  }
}

// Prisma model:
model User {
  id        String @id @default(cuid())
  email     String @unique
  ssn       String // Stored encrypted
  createdAt DateTime @default(now())
}
```

### 10.4 Bcrypt Password Hashing

```typescript
// backend-node/src/crypto/password.service.ts
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12; // High but not excessive

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Upgrade password hash on login (if rounds changed)
   */
  async shouldUpgradeHash(password: string, hash: string): Promise<boolean> {
    const rounds = parseInt(hash.split('$')[2]);
    return rounds < this.saltRounds;
  }

  async upgradeHash(password: string): Promise<string> {
    return this.hash(password);
  }
}

// Usage:
@Injectable()
export class AuthService {
  constructor(
    private passwords: PasswordService,
    private prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwords.verify(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Upgrade hash if needed (transparent to user)
    if (await this.passwords.shouldUpgradeHash(password, user.passwordHash)) {
      const newHash = await this.passwords.upgradeHash(password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    return this.generateTokens(user);
  }
}
```

### 10.5 API Key Security (Prefix Pattern)

Already covered in Section 5.4. Summarized:

- Prefix pattern: `alm_xxxxxxxx` (visible to user)
- Storage: `SHA256(full_key + pepper)` (unhashable)
- Verification: Constant-time comparison
- Expiration: Optional, tracked per-key
- Rotation: Generate new key, revoke old

### 10.6 Prisma SQL Injection Prevention

Always use `$queryRaw` with template literals (NOT string concatenation):

```typescript
// ❌ VULNERABLE: String concatenation
const dangerous = await this.prisma.$queryRaw(
  `SELECT * FROM users WHERE id = '${userId}'`
);

// ✅ SAFE: Template literals with parameter binding
const safe = await this.prisma.$queryRaw`
  SELECT * FROM "User" WHERE id = ${userId}
`;

// ✅ ALSO SAFE: Using Prisma query builder (no raw SQL)
const safe2 = await this.prisma.user.findUnique({
  where: { id: userId },
});
```

### 10.7 Helmet Security Headers

```typescript
// backend-node/src/main.ts
import helmet from '@nestjs/helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  }));

  await app.listen(3001);
}

bootstrap();
```

### 10.8 Stripe Webhook Signature Verification

```typescript
// backend-node/src/billing/webhook.controller.ts
import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import Stripe from 'stripe';

@Controller('webhooks')
export class WebhookController {
  private stripe: Stripe;

  constructor(private billingService: BillingService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>
  ) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody;

    let event: Stripe.Event;

    try {
      // Verify signature before processing
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }

    // Handle events
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.billingService.handlePaymentSucceeded(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.billingService.handleSubscriptionCanceled(event.data.object);
        break;

      default:
        this.logger.warn(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
```

### 10.9 OWASP Top 10 Compliance Checklist

```
A1: Broken Access Control
  [x] Role-based access control implemented
  [x] Guards check user authorization before every action
  [x] Workspace isolation enforced
  [x] API keys scoped to organization
  [x] No direct object reference (e.g., /portfolios/1 requires auth)

A2: Cryptographic Failures
  [x] HTTPS enforced (443 only)
  [x] AES-256-GCM for sensitive data
  [x] Bcrypt for passwords (salt rounds 12)
  [x] API keys hashed with SHA-256 + pepper
  [x] Encryption keys in environment variables

A3: Injection
  [x] Parameterized queries (Prisma template literals)
  [x] Input validation with class-validator
  [x] No string concatenation in SQL
  [x] Helmet CSP headers
  [x] XSS protection

A4: Insecure Design
  [x] Security-first architecture
  [x] Principle of least privilege
  [x] Input validation by default
  [x] Error messages don't leak info
  [x] Rate limiting on sensitive endpoints

A5: Security Misconfiguration
  [x] Helmet headers configured
  [x] CORS whitelist (not wildcard)
  [x] No debug logs in production
  [x] Secrets in environment variables
  [x] Health checks don't expose sensitive data

A6: Vulnerable & Outdated Components
  [x] npm audit regularly run
  [x] Automated dependency updates (Dependabot)
  [x] Node LTS versions only
  [x] No vulnerable packages in lockfile
  [x] Transitive dependencies scanned

A7: Identification & Authentication Failures
  [x] JWT with proper expiration
  [x] Refresh token rotation
  [x] Password complexity requirements
  [x] Rate limiting on auth endpoints
  [x] Token version tracking to prevent reuse

A8: Software & Data Integrity Failures
  [x] Code signed commits
  [x] Build artifacts signed
  [x] CI/CD pipeline secured
  [x] Secrets not in git history
  [x] Dependency integrity verified

A9: Logging & Monitoring Failures
  [x] Structured logging (Pino)
  [x] Error tracking (Sentry)
  [x] Distributed tracing (OpenTelemetry)
  [x] Audit trails for sensitive operations
  [x] No PII/tokens logged

A10: Server-Side Request Forgery (SSRF)
  [x] Outbound requests validated
  [x] No user-provided URLs in requests
  [x] Whitelist internal endpoints
  [x] Webhook URLs validated
```

---

## 11. Frontend Architecture

### 11.1 Next.js 16 App Router Patterns

**Directory structure:**

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── portfolios/page.tsx
│   │   │   ├── portfolios/[id]/page.tsx
│   │   │   ├── alm/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/route.ts
│   │   │   └── webhooks/stripe/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── shared/
│   │   ├── alm/
│   │   ├── charts/
│   │   └── forms/
│   ├── hooks/
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── utils.ts
│   └── store/
│       └── auth.ts
```

**Server Components vs Client Components:**

```typescript
// ✅ Good: Server Component (default)
// - No interactivity, fetches data
// - Used for lists, details pages
import { PortfolioService } from '@/lib/portfolio-service';

export default async function PortfolioPage() {
  const portfolio = await PortfolioService.getPortfolio('id');

  return (
    <div>
      <h1>{portfolio.name}</h1>
      <PortfolioChart data={portfolio} />
    </div>
  );
}

// ❌ Bad: Making Server Component interactive without need
export default async function PortfolioPage() {
  const [isLoading, setIsLoading] = useState(false); // ❌ Can't use hooks
}

// ✅ Good: Client Component (interactive features)
'use client';

import { useState } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';

export default function PortfolioForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { portfolio, updatePortfolio } = usePortfolio();

  return (
    <form onSubmit={handleSubmit}>
      {/* Interactive form */}
    </form>
  );
}

// ✅ Composition: Server Component uses Client Component
export default async function PortfolioPage() {
  const portfolio = await PortfolioService.getPortfolio('id');

  return (
    <div>
      <h1>{portfolio.name}</h1>
      {/* Client component for interactivity */}
      <EditPortfolioForm portfolio={portfolio} />
    </div>
  );
}
```

### 11.2 API Client Architecture

```typescript
// frontend/src/lib/api-client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

// Request interceptor: Add access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh access token
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;
        useAuthStore.setState({ accessToken });

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        useAuthStore.setState({ user: null, accessToken: null });
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### 11.3 Zustand State Management

```typescript
// frontend/src/store/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'OWNER' | 'ANALYST' | 'VIEWER';
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  activeWorkspace: string | null;
  activeOrganization: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      activeWorkspace: null,
      activeOrganization: null,

      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setActiveWorkspace: (workspaceId) => set({ activeWorkspace: workspaceId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          activeWorkspace: null,
        }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        // Only persist certain fields (not tokens in localStorage)
        user: state.user,
        activeWorkspace: state.activeWorkspace,
        activeOrganization: state.activeOrganization,
      }),
    }
  )
);
```

### 11.4 React Query (TanStack Query) Data Fetching

```typescript
// frontend/src/hooks/usePortfolios.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const usePortfolios = (workspaceId: string) => {
  return useQuery({
    queryKey: ['portfolios', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/portfolios', {
        params: { workspaceId },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // Cache for 10 minutes
  });
};

export const useCreatePortfolio = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuthStore();

  return useMutation({
    mutationFn: async (dto: CreatePortfolioDto) => {
      const { data } = await apiClient.post('/api/v1/portfolios', {
        ...dto,
        workspaceId: activeWorkspace,
      });
      return data;
    },

    onSuccess: (newPortfolio) => {
      // Invalidate list queries so they refetch
      queryClient.invalidateQueries({
        queryKey: ['portfolios', activeWorkspace],
      });

      // Optionally update cache with new data
      queryClient.setQueryData(
        ['portfolio', newPortfolio.id],
        newPortfolio
      );
    },

    onError: (error: AxiosError) => {
      // Handle error (show toast, etc.)
      console.error('Create failed:', error.response?.data);
    },
  });
};

// Usage in component:
export function CreatePortfolioButton() {
  const { mutate, isPending } = useCreatePortfolio();

  return (
    <button
      onClick={() => mutate({ name: 'New Portfolio' })}
      disabled={isPending}
    >
      {isPending ? 'Creating...' : 'Create'}
    </button>
  );
}
```

### 11.5 Form Validation with react-hook-form + Zod

```typescript
// frontend/src/schemas/portfolio.schema.ts
import { z } from 'zod';

export const CreatePortfolioSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
});

export type CreatePortfolioInput = z.infer<typeof CreatePortfolioSchema>;

// Component:
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePortfolioSchema } from '@/schemas/portfolio.schema';

export function PortfolioForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreatePortfolioSchema),
  });

  const { mutate: create } = useCreatePortfolio();

  return (
    <form onSubmit={handleSubmit((data) => create(data))}>
      <div>
        <input
          placeholder="Portfolio name"
          {...register('name')}
        />
        {errors.name && <span>{errors.name.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        Create
      </button>
    </form>
  );
}
```

### 11.6 Internationalization (i18n) - Bilingual ES/EN

```typescript
// frontend/src/lib/i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

// messages/en.json
{
  "nav": {
    "portfolios": "Portfolios",
    "alm": "ALM",
    "settings": "Settings"
  },
  "portfolio": {
    "title": "Portfolio",
    "create": "Create Portfolio",
    "delete": "Delete"
  }
}

// messages/es.json
{
  "nav": {
    "portfolios": "Carteras",
    "alm": "ALM",
    "settings": "Configuración"
  },
  "portfolio": {
    "title": "Cartera",
    "create": "Crear Cartera",
    "delete": "Eliminar"
  }
}

// Component usage:
'use client';

import { useTranslations } from 'next-intl';

export function Navigation() {
  const t = useTranslations('nav');

  return (
    <nav>
      <a href="/portfolios">{t('portfolios')}</a>
      <a href="/alm">{t('alm')}</a>
    </nav>
  );
}
```

### 11.7 Recharts for ALM Visualizations

```typescript
// frontend/src/components/alm/MaturityGapChart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MaturityGapData {
  period: string;
  assets: number;
  liabilities: number;
  gap: number;
}

export function MaturityGapChart({ data }: { data: MaturityGapData[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip
          formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
        />
        <Legend />
        <Bar dataKey="assets" fill="#2196F3" />
        <Bar dataKey="liabilities" fill="#FF9800" />
        <Bar dataKey="gap" fill="#4CAF50" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 11.8 File Upload Flow

```typescript
// frontend/src/components/file-upload.tsx
'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api-client';

export function FileUpload({ onSuccess }: { onSuccess: (file: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => {
      const file = files[0];

      const formData = new FormData();
      formData.append('file', file);

      setUploading(true);

      try {
        // Upload to backend
        const response = await apiClient.post(
          '/api/v1/files/upload',
          formData,
          {
            onUploadProgress: (e) => {
              const percentage = Math.round((e.loaded * 100) / e.total);
              setProgress(percentage);
            },
          }
        );

        onSuccess(response.data);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {uploading ? (
        <p>Uploading: {progress}%</p>
      ) : (
        <p>Drag files here or click to select</p>
      )}
    </div>
  );
}
```

### 11.9 Error Boundary and Loading States

```typescript
// frontend/src/components/error-boundary.tsx
'use client';

import { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback?.(this.state.error!) || (
          <div>
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage:
export default function Layout() {
  return (
    <ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
      <Navigation />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Content />
        </Suspense>
      </main>
    </ErrorBoundary>
  );
}
```

### 11.10 Authentication State Management

```typescript
// frontend/src/components/protected-route.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
```

---

## 12. PDF Generation Engine

### 12.1 PDFKit Implementation Patterns

```typescript
// backend-node/src/pdf/pdf.service.ts
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class PdfService {
  async generatePortfolioPdf(portfolio: Portfolio): Promise<Buffer> {
    const doc = new PDFDocument({
      margin: 40,
      size: 'LETTER',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Page 1: Cover
    this.addCover(doc, portfolio);
    doc.addPage();

    // Pages 2-7: English section
    this.addEnglishSection(doc, portfolio);
    doc.addPage();

    // Pages 8-14: Spanish section
    this.addSpanishSection(doc, portfolio);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);
    });
  }

  private addCover(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(36).text('CERNIQ', 100, 100);
    doc.fontSize(24).text('Portfolio Report', 100, 150);
    doc.fontSize(14).text(`Portfolio: ${portfolio.name}`, 100, 220);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 100, 250);
  }

  private addEnglishSection(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(18).text('Portfolio Overview', 50, 50);
    doc.fontSize(12).text(`Total Assets: $${portfolio.totalAssets}`, 50, 100);
    doc.text(`Total Liabilities: $${portfolio.totalLiabilities}`, 50, 130);
    doc.text(`Net Worth: $${portfolio.netWorth}`, 50, 160);
  }

  private addSpanishSection(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(18).text('Resumen de la Cartera', 50, 50);
    doc.fontSize(12).text(`Activos Totales: $${portfolio.totalAssets}`, 50, 100);
    doc.text(`Pasivos Totales: $${portfolio.totalLiabilities}`, 50, 130);
    doc.text(`Patrimonio Neto: $${portfolio.netWorth}`, 50, 160);
  }
}
```

### 12.2 Bilingual PDF Structure

```
Page 1:     Cover (CERNIQ Logo, Title, Date)
Pages 2-3:  Executive Summary (English)
Pages 4-5:  Portfolio Holdings (English)
Pages 6-7:  Risk Metrics (English)
Page 8:     Page Break + Spanish Section Header
Pages 9-10: Executive Summary (Spanish)
Pages 11-12: Portfolio Holdings (Spanish)
Pages 13-14: Risk Metrics (Spanish)
```

### 12.3 Chart Generation for PDF

```typescript
import { createCanvas } from 'canvas';

private addCharts(doc: PDFDocument, portfolio: Portfolio) {
  // Create chart image server-side
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext('2d');

  // Draw maturity gap chart
  this.drawMaturityGapChart(ctx, portfolio);

  const chartImage = canvas.toDataURL('image/png');
  doc.image(chartImage, 50, 200, { width: 500 });
}

private drawMaturityGapChart(ctx: CanvasRenderingContext2D, portfolio: Portfolio) {
  // Use canvas drawing API
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(50, 100, 100, 200); // Bar 1
  ctx.fillRect(200, 150, 100, 150); // Bar 2
  ctx.fillRect(350, 80, 100, 220);  // Bar 3

  // Labels
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.fillText('0-30d', 50, 320);
  ctx.fillText('30-90d', 200, 320);
  ctx.fillText('90d+', 350, 320);
}
```

### 12.4 Cloudflare R2 Upload + Presigned URLs

```typescript
// backend-node/src/storage/r2.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
  }

  async uploadPdf(
    portfolioId: string,
    fileName: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    const key = `portfolios/${portfolioId}/${fileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    // Return presigned URL (valid for 24 hours)
    return this.getPresignedUrl(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 86400 });
  }
}

// Usage:
@Injectable()
export class ReportService {
  constructor(
    private pdf: PdfService,
    private r2: R2Service,
  ) {}

  async generateAndUploadReport(portfolioId: string) {
    const portfolio = await this.getPortfolio(portfolioId);
    const pdfBuffer = await this.pdf.generatePortfolioPdf(portfolio);

    const fileName = `report_${Date.now()}.pdf`;
    const presignedUrl = await this.r2.uploadPdf(
      portfolioId,
      fileName,
      pdfBuffer
    );

    return { presignedUrl, fileName };
  }
}
```

### 12.5 Report Job State Machine (9 Stages)

```
1. QUEUED
   ↓
2. PROCESSING (validating portfolio, collecting data)
   ↓
3. CALCULATING (running ALM, risk metrics)
   ↓
4. GENERATING (creating PDF with charts)
   ↓
5. UPLOADING (storing in R2)
   ↓
6. COMPLETED (presigned URL ready)
   ↓
7. EXPIRED (older than 30 days, removed from R2)

ERROR STATES:
   ✗ FAILED (any step failed)
   ✗ TIMEOUT (took > 5 minutes)
```

```typescript
@Injectable()
export class ReportJobService {
  async createJob(portfolioId: string) {
    return this.prisma.reportJob.create({
      data: {
        portfolioId,
        status: 'QUEUED',
      },
    });
  }

  async processJob(jobId: string) {
    const job = await this.prisma.reportJob.findUnique({
      where: { id: jobId },
    });

    try {
      await this.updateJobStatus(jobId, 'PROCESSING');
      const portfolio = await this.getPortfolio(job.portfolioId);

      await this.updateJobStatus(jobId, 'CALCULATING');
      const almResult = await this.alm.calculate(portfolio);

      await this.updateJobStatus(jobId, 'GENERATING');
      const pdfBuffer = await this.pdf.generatePortfolioPdf(portfolio);

      await this.updateJobStatus(jobId, 'UPLOADING');
      const url = await this.r2.uploadPdf(job.portfolioId, `report.pdf`, pdfBuffer);

      await this.updateJobStatus(jobId, 'COMPLETED', { presignedUrl: url });
    } catch (error) {
      await this.updateJobStatus(jobId, 'FAILED', { error: error.message });
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    data?: any
  ) {
    return this.prisma.reportJob.update({
      where: { id: jobId },
      data: {
        status,
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}
```

---

## 13. Code Conventions & Patterns

### 13.1 TypeScript Patterns Used Throughout

**Discriminated Unions:**

```typescript
type Asset =
  | { type: 'BOND'; yield: number; maturityDate: Date }
  | { type: 'EQUITY'; dividend: number; volatility: number }
  | { type: 'CASH'; rate: number };

function calculateReturn(asset: Asset): number {
  switch (asset.type) {
    case 'BOND':
      return asset.yield * 100;
    case 'EQUITY':
      return asset.dividend + (asset.volatility * 0.5);
    case 'CASH':
      return asset.rate;
  }
}
```

**Branded Types:**

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type PortfolioId = string & { readonly __brand: 'PortfolioId' };

const createUserId = (id: string): UserId => id as UserId;
const createPortfolioId = (id: string): PortfolioId => id as PortfolioId;

function getPortfolio(id: PortfolioId) {
  // id is guaranteed to be a portfolio ID, not a user ID
}
```

**Mapped Types:**

```typescript
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Partial<T> = {
  [K in keyof T]?: T[K];
};

type GettersSetters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
} & {
  [K in keyof T as `set${Capitalize<string & K>}`]: (v: T[K]) => void;
};
```

### 13.2 NestJS Decorators Cheat Sheet

```typescript
// Method decorators
@Get('/:id')                      // GET /api/resource/:id
@Post()                           // POST /api/resource
@Patch('/:id')                    // PATCH /api/resource/:id
@Delete('/:id')                   // DELETE /api/resource/:id
@Put('/:id')                      // PUT /api/resource/:id

// Parameter decorators
@Param('id')                      // Extract from URL parameter
@Query('limit')                   // Extract from query string
@Body()                           // Extract request body
@Headers('authorization')         // Extract HTTP header
@Req()                            // Inject entire request object
@Res()                            // Inject entire response object

// Guard & Interceptor decorators
@UseGuards(AuthGuard)             // Apply guard before handler
@UseInterceptors(CachingInterceptor)  // Apply interceptor
@UseFilters(ExceptionFilter)      // Apply exception filter

// Metadata decorators
@SetMetadata('roles', ['OWNER'])  // Set metadata for guards
@Roles('OWNER', 'ANALYST')        // Custom metadata

// Provider decorators
@Injectable()                     // Mark as injectable service
@Global()                         // Make module global
@Optional()                       // Mark dependency as optional
@Inject('TOKEN')                  // Inject by token/string
```

### 13.3 Prisma Patterns

```typescript
// findFirst vs findUnique
// Use findUnique only for unique constraints
await prisma.user.findUnique({
  where: { email: 'user@example.com' }, // email is @unique
});

// Use findFirst for non-unique fields
await prisma.portfolio.findFirst({
  where: { organizationId: 'org_123' },
});

// Upsert (create or update)
await prisma.user.upsert({
  where: { email: 'user@example.com' },
  update: { lastLogin: new Date() },
  create: { email: 'user@example.com', name: 'User' },
});

// Cursor-based pagination (better for large datasets)
await prisma.portfolio.findMany({
  take: 20,
  skip: 0, // Or use: cursor: { id: 'last_id' }, skip: 1
  cursor: { id: 'cursor_portfolio_id' },
  orderBy: { createdAt: 'desc' },
});

// Transactions
await prisma.$transaction(async (tx) => {
  await tx.user.update({ ... });
  await tx.portfolio.create({ ... });
});

// Raw queries (ONLY with template literals)
await prisma.$queryRaw`
  SELECT * FROM "Portfolio" WHERE "organizationId" = ${orgId}
`;
```

### 13.4 Response DTO Patterns

```typescript
// ALWAYS return typed responses
@Get(':id')
async getPortfolio(@Param('id') id: string): Promise<PortfolioResponseDto> {
  const portfolio = await this.service.getPortfolio(id);
  return new PortfolioResponseDto(portfolio); // Map to DTO
}

// NEVER leak internal IDs unnecessarily
export class PortfolioResponseDto {
  id: string;
  name: string;
  totalAssets: number;
  // Do NOT include: createdById, internalDbId, tempWorkingId

  constructor(portfolio: Portfolio) {
    this.id = portfolio.id;
    this.name = portfolio.name;
    this.totalAssets = portfolio.assets.length;
  }
}

// Transform nested relations
export class PortfolioDetailResponseDto {
  id: string;
  name: string;
  assets: AssetSummaryDto[];

  constructor(portfolio: Portfolio) {
    this.id = portfolio.id;
    this.name = portfolio.name;
    this.assets = portfolio.assets.map(
      a => new AssetSummaryDto(a)
    );
  }
}
```

### 13.5 Import Organization Conventions

```typescript
// 1. NestJS & third-party
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// 2. Custom services/modules
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

// 3. DTOs & types
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { Portfolio } from '@prisma/client';

// 4. Utilities
import { generateId } from '@/lib/utils';
import { logger } from '@/logger';

// Blank line between groups
```

### 13.6 File Naming Conventions

```
Services:          *.service.ts        portfolio.service.ts
Controllers:       *.controller.ts     portfolio.controller.ts
DTOs:              *.dto.ts            create-portfolio.dto.ts
Guards:            *.guard.ts          auth.guard.ts
Interceptors:      *.interceptor.ts    caching.interceptor.ts
Filters:           *.filter.ts         exception.filter.ts
Modules:           *.module.ts         portfolio.module.ts
Specs (tests):     *.spec.ts           portfolio.service.spec.ts
E2E tests:         *.e2e.spec.ts       portfolio.e2e.spec.ts
Decorators:        *.decorator.ts      current-user.decorator.ts
Middleware:        *.middleware.ts     correlation-id.middleware.ts
Pipes:             *.pipe.ts           validation.pipe.ts
Strategies:        *.strategy.ts       jwt.strategy.ts
```

---

## 14. Known Technical Debt & Fix Priority

### 14.1 Critical Fixes (Do ASAP)

**1. Docker Compose Database Name Mismatch**

*Problem:* docker-compose.yml uses `DATABASE_NAME=cerniq_dev`, but migrations expect `cerniq`.

*Impact:* Local development setup fails silently, migrations don't run.

*Fix:*
```yaml
# docker-compose.yml
environment:
  - POSTGRES_DB=cerniq_dev  # ← Change to match migrations
```

*Effort:* 15 minutes

**2. Risk Controller Prefix Inconsistency**

*Problem:* Risk endpoints have conflicting prefixes: `/api/v1/risk` vs `/api/v1/portfolio/:id/risk`.

*Impact:* API documentation confusing, frontend hard to maintain.

*Fix:*
```typescript
// Standardize all risk endpoints under /api/v1/risk
@Controller('api/v1/risk')
export class RiskController {
  @Post('/calculate/:portfolioId')
  async calculate(@Param('portfolioId') id: string) { ... }
}
```

*Effort:* 1 hour

**3. Dual Token Storage**

*Problem:* AccessToken stored in both memory AND localStorage, causing sync issues.

*Impact:* Token refresh fails if browser/tab out of sync.

*Fix:*
```typescript
// Store ONLY in memory + httpOnly cookie
// localStorage: activeWorkspace, user.id only (not tokens)
```

*Effort:* 2 hours

### 14.2 Medium Priority (Next Quarter)

**1. BullMQ Job Queue**

*Current:* PDF jobs process synchronously in request handler.

*Problem:* Long-running jobs timeout (5s limit on serverless).

*Solution:*
```typescript
// Implement BullMQ for background jobs
@InjectQueue('reports')
private reportQueue: Queue;

async generateReport(portfolioId: string) {
  await this.reportQueue.add('generate', { portfolioId });
  return { jobId: job.id, status: 'queued' };
}
```

*Benefit:* Handle 30s+ PDF generation, retry failed jobs, track progress.

*Effort:* 8 hours

**2. Redis Caching for ALM**

*Current:* ALM calculations not cached.

*Problem:* Same calculation runs multiple times, slow performance.

*Solution:* Cache with 10-minute TTL, invalidate on portfolio update.

*Benefit:* 70%+ cache hit ratio, < 50ms response time.

*Effort:* 6 hours

**3. API Versioning**

*Current:* Only `/api/v1/`, no strategy for v2.

*Problem:* Breaking changes require immediate migration.

*Solution:*
```typescript
// Support both versions
@Controller('api/v1/portfolios')
@Controller('api/v2/portfolios') // Enhanced response format
```

*Benefit:* Non-breaking evolution, gradual migration.

*Effort:* 4 hours

### 14.3 Low Priority (Future Optimization)

**1. TimescaleDB for Market Data**

*Current:* PostgreSQL stores historical prices + metrics.

*Problem:* Time-series queries slow on large datasets (> 1M rows).

*Solution:* Migrate historical_prices → TimescaleDB hypertable.

*Benefit:* 10-100x faster time-series queries.

*Effort:* 16 hours, requires migration strategy

**2. Dead Code Cleanup**

*Current:* Legacy email templates, old asset validators.

*Problem:* Code cluttered, maintenance overhead.

*Solution:* Remove unused files, consolidate validators.

*Effort:* 3 hours

**3. Frontend Component Library Storybook**

*Current:* No component documentation.

*Problem:* Developers duplicate components, inconsistent UI.

*Solution:* Set up Storybook, document shared components.

*Benefit:* Faster feature development, consistent UI.

*Effort:* 8 hours

---

## Appendix: Deployment Checklist

Before deploying to production:

- [ ] All tests passing (unit + E2E)
- [ ] TypeScript strict mode compliant
- [ ] ESLint + Prettier passing
- [ ] Database migrations tested locally
- [ ] Env variables set in Railway + Vercel
- [ ] Sentry DSN configured
- [ ] CORS whitelist updated
- [ ] Rate limiting verified
- [ ] Health checks responding
- [ ] API documentation updated
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Slack deployment message posted
- [ ] Monitoring dashboards checked
- [ ] Backup created

---

**Last Updated:** March 27, 2026

This Engineering Bible is a living document. Update it when:
- New patterns are established
- Best practices change
- Common mistakes are discovered
- New modules are created
- Major refactors are completed
