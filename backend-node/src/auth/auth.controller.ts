import {
  Controller,
  ForbiddenException,
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
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AllowBlockedAccess } from './allow-blocked-access.decorator';
import {
  clearAuthCookies,
  resolveFrontendUrl,
  setAuthCookies,
} from './auth-cookie.util';
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
import { SkipAuditLog } from '../common/decorators/audit-action.decorator';

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
  @ApiResponse({
    status: 201,
    description: 'User registered and authentication cookies set',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid registration data or email already exists',
  })
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
  @SkipAuditLog()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, authentication cookies set',
  })
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
  @ApiResponse({
    status: 200,
    description: 'New tokens issued and cookies set',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const token = body.refreshToken || req.cookies?.refresh_token;
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
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
  @AllowBlockedAccess()
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile with subscription and workspace data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: any) {
    return this.authService.getUserProfile(req.user.userId, req.user.email);
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
  @ApiResponse({
    status: 201,
    description: 'API key created (secret shown only once)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createApiKey(@Req() req: any, @Body() dto: CreateApiKeyDto) {
    if (String(req.user?.role || '').toUpperCase() !== 'OWNER') {
      throw new ForbiddenException('Owner access required');
    }
    return this.authService.createApiKey(
      req.user.userId,
      dto.name,
      dto.expiresInDays,
    );
  }

  @Post('api-keys/:keyId/revoke')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(AuthGuard)
  async revokeApiKey(@Req() req: any, @Param('keyId') keyId: string) {
    if (String(req.user?.role || '').toUpperCase() !== 'OWNER') {
      throw new ForbiddenException('Owner access required');
    }
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

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const user = req.user;
    const tokens = await this.authService.generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = resolveFrontendUrl();
    res.redirect(
      `${frontendUrl}/auth/callback?returnUrl=${encodeURIComponent('/dashboard')}`,
    );
  }

  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  async githubCallback(@Req() req: any, @Res() res: any) {
    const user = req.user;
    const tokens = await this.authService.generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = resolveFrontendUrl();
    res.redirect(
      `${frontendUrl}/auth/callback?returnUrl=${encodeURIComponent('/dashboard')}`,
    );
  }
}
