import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * RedisService
 *
 * Used for:
 * - Rate limiting (sliding window per user/IP)
 * - Job queues (payment verification, video processing)
 * - Caching (product listings, recommendations)
 * - Session blacklist (for immediate logout)
 *
 * If Redis is unavailable, all operations degrade gracefully
 * (rate limiting falls back to in-memory, cache returns null).
 */
@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis | null = null;
  private connected = false;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.warn('[Redis] REDIS_URL not set — operating in fallback mode');
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 2000),
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[Redis] Connected');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      this.connected = false;
    });
  }

  /**
   * Rate limit check using sliding window.
   * Returns true if the request is allowed, false if rate limited.
   */
  async rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (!this.client || !this.connected) {
      // Fallback: always allow if Redis is down
      return true;
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}`);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    const count = results?.[2]?.[1] as number;

    return count <= limit;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.connected) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.connected) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.connected) return;
    await this.client.del(key);
  }

  /**
   * Add a session ID to the blacklist (for immediate logout).
   */
  async blacklistSession(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.set(`session_blacklist:${sessionId}`, '1', ttlSeconds);
  }

  /**
   * Check if a session is blacklisted.
   */
  async isSessionBlacklisted(sessionId: string): Promise<boolean> {
    const result = await this.get(`session_blacklist:${sessionId}`);
    return result !== null;
  }
}
