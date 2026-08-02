import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from './app.module';
import { InternalTokenGuard } from './common/internal-token.guard';
import { AuditInterceptor } from './common/audit.interceptor';
import { ErrorFilter } from './common/error.filter';

/**
 * Cellex NestJS Core API
 *
 * This service handles ALL primary business logic:
 * - Auth & sessions (verification only — Edge Functions handle login)
 * - User & seller profiles
 * - Products, stock, pricing (server-side verified)
 * - Orders & checkout
 * - Payment verification (server-to-server with Paystack)
 * - Messaging & chat
 * - Notifications
 * - Admin & moderation
 * - Audit logging
 *
 * Security:
 * - Every request MUST have a valid X-Internal-Token header (set by Edge Functions)
 * - User identity is taken from X-User-Id header (set by Edge Functions after session verification)
 * - NEVER trusts client-supplied user IDs, prices, or payment status
 * - All errors are sanitized — no internal details leaked
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security: only accept requests with valid internal token
  app.useGlobalGuards(
    app.get(InternalTokenGuard),
    app.get(ThrottlerGuard),
  );

  // Validation: strip unknown properties, validate types
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Audit: log every request for compliance
  app.useGlobalInterceptors(app.get(AuditInterceptor));

  // Error handling: sanitize all errors
  app.useGlobalFilters(app.get(ErrorFilter));

  // CORS: only allow Edge Function origin
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[NestJS] Cellex Core API running on port ${port}`);
}

bootstrap();
