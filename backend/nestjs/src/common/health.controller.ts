import { Controller, Get } from '@nestjs/common';

/**
 * HealthController
 *
 * Returns service health status. Used by Render for health checks
 * and by the Edge Function gateway to verify NestJS is reachable.
 *
 * This endpoint does NOT require an internal token — it only returns
 * "ok" with no sensitive information.
 */
@Controller('health')
export class HealthController {
  @Get()
  async health() {
    return {
      status: 'ok',
      service: 'cellex-nestjs-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
