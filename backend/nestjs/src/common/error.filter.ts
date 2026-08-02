import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * ErrorFilter
 *
 * Catches ALL exceptions and returns a sanitized error response.
 * NEVER leaks internal details (stack traces, DB errors, file paths).
 *
 * Returns:
 *   { success: false, error: "Human-readable message", requestId: "..." }
 *
 * Internal errors are logged server-side but the client only sees
 * a generic message.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message = 'An error occurred. Please try again.';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || message;
        code = (res as any).code || code;
      }
    } else if (exception instanceof Error) {
      // Log the real error internally, but don't expose it
      this.logger.error(`[${request.headers['x-request-id'] || 'no-id'}] ${exception.message}`, exception.stack);
      
      // Map known DB errors to user-friendly messages
      if (exception.message.includes('duplicate key')) {
        status = 409;
        message = 'This item already exists.';
        code = 'DUPLICATE';
      } else if (exception.message.includes('foreign key')) {
        status = 400;
        message = 'Referenced item not found.';
        code = 'INVALID_REFERENCE';
      } else if (exception.message.includes('not null')) {
        status = 400;
        message = 'Missing required field.';
        code = 'MISSING_FIELD';
      }
    }

    response.status(status).json({
      success: false,
      error: message,
      code,
      requestId: request.headers['x-request-id'] || undefined,
    });
  }
}
