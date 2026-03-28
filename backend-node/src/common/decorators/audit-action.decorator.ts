import { SetMetadata } from '@nestjs/common';

/**
 * @AuditAction decorator — tag endpoints with explicit audit action names.
 * Used by AuditLogInterceptor to generate human-readable audit trail entries
 * instead of inferring from HTTP method.
 *
 * Usage:
 *   @AuditAction('GENERATE_REPORT')
 *   @Post(':institutionId/report')
 *   async generateReport() { ... }
 */
export const AUDIT_ACTION_KEY = 'audit_action';
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
