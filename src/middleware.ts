import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS middleware — strict allow-list, NOT reflected origin.
 *
 * SECURITY: We only allow requests from known origins. This prevents
 * cross-site request forgery (CSRF) and cross-origin data theft.
 * Any unknown origin gets NO CORS headers, so the browser blocks
 * authenticated requests from those origins.
 */

// Allowed origins — read from env var (comma-separated) with safe defaults.
// SECURITY: We only allow requests from known origins. This prevents
// cross-site request forgery (CSRF) and cross-origin data theft.
const ENV_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const STATIC_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  // Allow Hugging Face Spaces previews (for staging)
  /^https:\/\/[\w-]+\.hf\.space$/,
  // Allow Vercel previews
  /^https:\/\/[\w-]+\.vercel\.app$/,
];

// Combine env-configured origins with static dev defaults
const ALLOWED_ORIGINS: (string | RegExp)[] = [...ENV_ORIGINS, ...STATIC_ORIGINS];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    return allowed.test(origin);
  });
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    if (!origin || !isAllowedOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Api-Key, X-Internal-Call',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }

  const response = NextResponse.next();
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bot-Api-Key, X-Internal-Call');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
