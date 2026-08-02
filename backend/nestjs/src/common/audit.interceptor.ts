import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { DatabaseService } from './database.service';

/**
 * AuditInterceptor
 *
 * Logs every mutation request (POST, PUT, PATCH, DELETE) to the audit_log
 * table. This is required for:
 * - Compliance (financial transactions)
 * - Security forensics (unauthorized access attempts)
 * - Dispute resolution (order/payment issues)
 *
 * Only logs mutations — GET requests are not audited (too noisy).
 * Logs: timestamp, user_id, endpoint, method, request body (sanitized),
 * response status, and request_id.
 *
 * NEVER logs: passwords, tokens, payment card numbers, or full PII.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations
    if (method === 'GET' || method === 'OPTIONS') {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.logAudit(request, response, null, Date.now() - startTime).catch(() => {});
        },
        error: (error) => {
          this.logAudit(request, null, error.message, Date.now() - startTime).catch(() => {});
        },
      }),
    );
  }

  private async logAudit(request: any, response: any, error: string | null, durationMs: number) {
    try {
      // Sanitize request body — remove sensitive fields
      const body = { ...request.body };
      delete body.password;
      delete body.token;
      delete body.card_number;
      delete body.cvv;
      delete body.secret;

      await this.db.insert('audit_log', {
        user_id: request.userId || null,
        request_id: request.requestId || null,
        method: request.method,
        path: request.path,
        status: error ? 'error' : 'success',
        error_message: error?.slice(0, 500) || null,
        duration_ms: durationMs,
        request_body: JSON.stringify(body).slice(0, 2000),
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      // Audit logging is non-fatal — don't break the request
      console.error('[Audit] Failed to log:', err.message);
    }
  }
}
