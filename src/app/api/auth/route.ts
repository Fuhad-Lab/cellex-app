import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

// ---- Simple in-memory rate limiter (per IP, per op) ----
// Prevents brute-force attacks on login/signup.
// Limits: 10 attempts per minute per IP for login/signup ops.
// Note: This is in-memory and resets on server restart. For production-grade
// rate limiting, use a Redis-backed solution. But this blocks 99% of
// automated brute-force scripts.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10;     // max attempts per window per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

// Clean up old entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  const cleanup = globalThis as unknown as { __rateLimitCleanup?: NodeJS.Timeout };
  if (!cleanup.__rateLimitCleanup) {
    cleanup.__rateLimitCleanup = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of rateLimitMap.entries()) {
        if (now > entry.resetAt) {
          rateLimitMap.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
  }
}

function getClientIP(request: NextRequest): string {
  // Check common headers set by reverse proxies (HF Space, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  return 'unknown';
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  const body = await request.text();

  // Parse the body to check the op
  let bodyJson: { op?: string; refresh_token?: string; email?: string; password?: string } = {};
  try {
    bodyJson = JSON.parse(body);
  } catch {
    // Invalid JSON — let it through to the edge function which will handle the error
  }

  // Rate limit only login/signup attempts (not session checks, logout, etc.)
  if (bodyJson.op === 'login' || bodyJson.op === 'signup') {
    const ip = getClientIP(request);
    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Try again in ${retryAfter} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }
  }

  // === MOBILE OAUTH: Token refresh endpoint ===
  // Mobile clients call this with their refresh_token (stored in OS secure storage)
  // to get a new short-lived access_token when the old one expires (1 hour).
  // The refresh_token itself is long-lived (60 days with sliding expiration).
  if (bodyJson.op === 'refresh') {
    const refreshToken = bodyJson.refresh_token;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'refresh_token required' },
        { status: 400 }
      );
    }

    try {
      // Call Supabase Auth's refresh endpoint
      const refreshResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await refreshResp.json();

      if (!refreshResp.ok) {
        return NextResponse.json(
          { success: false, error: data.error || data.message || 'Token refresh failed' },
          { status: refreshResp.status }
        );
      }

      // Return the new tokens to the mobile client
      return NextResponse.json({
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in, // seconds (typically 3600 = 1 hour)
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Token refresh service unavailable' },
        { status: 503 }
      );
    }
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }

  const botKey = request.headers.get('X-Bot-Api-Key');
  if (botKey) headers['X-Bot-Api-Key'] = botKey;
  const internalKey = request.headers.get('X-Internal-Call');
  if (internalKey) headers['X-Internal-Call'] = internalKey;

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await resp.json();

    if (bodyJson.op === 'login' || bodyJson.op === 'signup') {
      if (data.success && data.session_id) {
        const response = NextResponse.json(
          { ...data, session_id: undefined },
          { status: resp.status }
        );
        // Set the session cookie — HttpOnly, Secure, SameSite=Lax
        // (SameSite=Lax prevents CSRF on cross-site requests while allowing
        // top-level navigation GETs)
        response.cookies.set(COOKIE_NAME, data.session_id, {
          httpOnly: true,
          secure: true, // always secure — Render uses HTTPS
          sameSite: 'lax',
          maxAge: 60 * 24 * 60 * 60, // 60 days — matches sliding expiration
          path: '/',
        });
        // Set the CSRF token cookie — NOT HttpOnly (JS must read it)
        // This is the "double-submit cookie" pattern used by Meta/Django
        const csrfToken = generateCsrfToken();
        setCsrfCookie(response, csrfToken);
        return response;
      }
    }

    if (bodyJson.op === 'logout') {
      const response = NextResponse.json(data, { status: resp.status });
      response.cookies.delete(COOKIE_NAME);
      response.cookies.delete('cellex_csrftoken'); // clear CSRF on logout
      return response;
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
