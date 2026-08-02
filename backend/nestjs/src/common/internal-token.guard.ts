import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * InternalTokenGuard
 *
 * Verifies that every incoming request has a valid X-Internal-Token header.
 * This token is set by Supabase Edge Functions and proves the request
 * came through the secure middle layer — NOT directly from the frontend.
 *
 * If an attacker bypasses Edge Functions and calls NestJS directly,
 * they won't have this token and the request is rejected.
 *
 * The token is stored in Supabase Secrets and shared between
 * Edge Functions and NestJS. NEVER in the frontend.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly expectedToken: string;

  constructor() {
    this.expectedToken = process.env.CELLEX_INTERNAL_TOKEN || '';
    if (!this.expectedToken) {
      console.error('[Security] CELLEX_INTERNAL_TOKEN not set — rejecting all requests');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];

    if (!token || token !== this.expectedToken) {
      throw new UnauthorizedException('Invalid request source');
    }

    // Extract user ID from header (set by Edge Functions after session verification)
    // NestJS trusts this ID because only Edge Functions can set it (they verify the session)
    const userId = request.headers['x-user-id'];
    if (userId) {
      request.userId = userId;
      request.userEmail = request.headers['x-user-email'] || '';
    }

    // Request ID for audit tracing
    request.requestId = request.headers['x-request-id'] || '';

    return true;
  }
}
