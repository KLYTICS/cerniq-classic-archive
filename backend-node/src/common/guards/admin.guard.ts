import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY;

    if (!expectedKey) {
      this.logger.warn('ADMIN_KEY not configured — admin endpoints disabled');
      throw new UnauthorizedException('Admin access not configured');
    }

    if (!adminKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin key');
    }

    return true;
  }
}
