import { NextRequest, NextResponse } from 'next/server';

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
  let bodyJson: { op?: string } = {};
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
        response.cookies.set(COOKIE_NAME, data.session_id, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
        return response;
      }
    }

    if (bodyJson.op === 'logout') {
      const response = NextResponse.json(data, { status: resp.status });
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
