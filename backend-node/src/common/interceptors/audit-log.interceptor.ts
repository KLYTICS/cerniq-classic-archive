import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma.service';

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    if (!METHOD_ACTION_MAP[method]) {
      return next.handle();
    }

    const action = METHOD_ACTION_MAP[method];
    const userId = request.user?.userId || null;
    const resource = this.extractResource(request.route?.path || request.url);
    const resourceId =
      request.params?.id ||
      request.params?.institutionId ||
      request.params?.runId ||
      null;
    const ipAddress =
      request.ip || request.headers?.['x-forwarded-for'] || null;
    const userAgent = request.headers?.['user-agent'] || null;
    const tenantId = request.user?.orgId || null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.persistAuditLog({
            userId,
            action,
            resource,
            resourceId,
            changes: method === 'DELETE' ? null : request.body || null,
            ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
            userAgent: typeof userAgent === 'string' ? userAgent : null,
            tenantId,
          });
        },
        error: () => {
          // Do not log on failed requests
        },
      }),
    );
  }

  private extractResource(routePath: string): string {
    return routePath
      .replace(/^\/api\//, '')
      .replace(/\/:[^/]+/g, '')
      .replace(/\//g, '_')
      .replace(/-/g, '_')
      .toLowerCase();
  }

  private persistAuditLog(data: {
    userId: string | null;
    action: string;
    resource: string;
    resourceId: string | null;
    changes: any;
    ipAddress: string | null;
    userAgent: string | null;
    tenantId: string | null;
  }): void {
    this.prisma.auditLog
      .create({ data })
      .then(() => {
        this.logger.debug(
          `Audit: ${data.action} ${data.resource} ${data.resourceId || '(no id)'} by ${data.userId || 'anonymous'}`,
        );
      })
      .catch((err: any) => {
        this.logger.error(`Failed to persist audit log: ${err.message}`);
      });
  }
}
