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
DATABASE_URL="postgresql://<user>@localhost:5432/cerniq?schema=public&connection_limit=5"

# Production (Railway, Vercel)
DATABASE_URL="postgresql://<user>@db-instance.railway.app:5432/cerniq?sslmode=require&connection_limit=20"
DIRECT_URL="postgresql://<user>@db-instance.railway.app:5432/cerniq?sslmode=require"  # For migrations
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
