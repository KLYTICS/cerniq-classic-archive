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
          DATABASE_URL: postgresql://<user>@localhost:5432/cerniq_test
        run: |
          cd backend-node
          npx prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://<user>@localhost:5432/cerniq_test
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
