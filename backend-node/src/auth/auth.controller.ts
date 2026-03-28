import {
  Controller,
  Post,
  Put,
  Body,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import {
  RegisterDto,
  LoginDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  ChangePasswordDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { AuditService } from '../audit/audit.service';

const isProduction = process.env.NODE_ENV === 'production';

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
  const configured = (process.env.AUTH_COOKIE_SAMESITE || '')
    .trim()
    .toLowerCase();
  if (
    configured === 'strict' ||
    configured === 'none' ||
    configured === 'lax'
  ) {
    return configured;
  }
  return 'lax';
}

function resolveFrontendUrl(): string {
  const configured = (process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  if (!isProduction) {
    return 'http://localhost:3001';
  }
  return 'https://cerniq.io';
}

const COOKIE_SECURE = parseBoolean(
  process.env.AUTH_COOKIE_SECURE,
  isProduction,
);
const COOKIE_SAME_SITE = resolveCookieSameSite();
const COOKIE_DOMAIN = (process.env.AUTH_COOKIE_DOMAIN || '').trim();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

const ACCESS_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24h
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearAuthCookies(res: any) {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);
}

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered and authentication cookies set' })
  @ApiResponse({ status: 400, description: 'Invalid registration data or email already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (max 3/min)' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.register(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, authentication cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (max 5/min)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.login(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    this.audit.log({
      userId: result.user.id,
      action: 'login',
      resource: 'user',
      outcome: 'success',
      metadata: { method: 'password' },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'New tokens issued and cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const token = body.refreshToken || req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }
    const result = await this.authService.refreshTokens(token);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile with subscription and workspace data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: any) {
    return this.authService.getUserProfile(req.user.userId);
  }

  @Get('whoami')
  @UseGuards(AuthGuard)
  async whoami(@Req() req: any) {
    const claims = req.user?.claims || {};
    const expectedIssuer =
      process.env.SUPABASE_JWT_ISSUER || process.env.SUPABASE_ISSUER || null;
    const expectedAudience =
      process.env.SUPABASE_JWT_AUDIENCE ||
      process.env.SUPABASE_AUDIENCE ||
      null;
    const tokenAud = claims?.aud;
    const audOk =
      !expectedAudience ||
      tokenAud === expectedAudience ||
      (Array.isArray(tokenAud) && tokenAud.includes(expectedAudience));

    return {
      user_id: req.user.userId,
      email: req.user.email,
      orgs: await this.authService.getUserOrgs(req.user.userId),
      app: process.env.KLYTICS_APP_ID || 'cerniq',
      issuer_ok: !expectedIssuer || claims?.iss === expectedIssuer,
      aud_ok: audOk,
    };
  }

  @Put('password')
  @UseGuards(AuthGuard)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Get('api-keys')
  @UseGuards(AuthGuard)
  async listApiKeys(@Req() req: any) {
    const keys = await this.authService.listApiKeys(req.user.userId);
    return { keys };
  }

  @Post('api-keys')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Create a new API key for programmatic access' })
  @ApiResponse({ status: 201, description: 'API key created (secret shown only once)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createApiKey(@Req() req: any, @Body() dto: CreateApiKeyDto) {
    const created = await this.authService.createApiKey(
      req.user.userId,
      dto.name,
      dto.expiresInDays,
    );
    return created;
  }

  @Post('api-keys/:keyId/revoke')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(AuthGuard)
  async revokeApiKey(@Req() req: any, @Param('keyId') keyId: string) {
    return this.authService.revokeApiKey(req.user.userId, keyId);
  }

  @Post('password-reset')
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // --- OAuth: Google ---
  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const user = req.user;
    const tokens = await this.authService.generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = resolveFrontendUrl();
    res.redirect(`${frontendUrl}/dashboard`);
  }

  // --- OAuth: GitHub ---
  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  githubAuth() {
    // Passport redirects to GitHub
  }

  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  async githubCallback(@Req() req: any, @Res() res: any) {
    const user = req.user;
    const tokens = await this.authService.generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = resolveFrontendUrl();
    res.redirect(`${frontendUrl}/dashboard`);
  }
}
