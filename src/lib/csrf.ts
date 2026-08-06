/**
 * CSRF (Cross-Site Request Forgery) protection utilities.
 *
 * Architecture (Meta-style):
 * 1. On login/signup, the server sets TWO cookies:
 *    - `cellex_session_id` — HttpOnly, Secure, SameSite=Lax (the session token)
 *    - `cellex_csrftoken` — NOT HttpOnly (readable by JS), Secure, SameSite=Lax
 * 2. The frontend reads `cellex_csrftoken` and sends it as `X-CSRF-Token` header
 *    on every state-changing request (POST, PUT, PATCH, DELETE).
 * 3. The server validates that the `X-CSRF-Token` header matches the
 *    `cellex_csrftoken` cookie. If they don't match, the request is rejected.
 *
 * This is the "double-submit cookie" pattern — an attacker cannot forge a
 * request because they cannot read the CSRF token from the cookie (same-origin
 * policy prevents cross-site reads), and they cannot set custom headers
 * without CORS preflight.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'cellex_csrftoken';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Generate a cryptographically random CSRF token (32 bytes = 256 bits).
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set the CSRF cookie on a response — NOT HttpOnly (JS must read it).
 * Secure + SameSite=Lax for protection.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JS must be able to read this
    secure: true, // always secure — Render uses HTTPS
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60, // 60 days — matches session cookie
    path: '/',
  });
}

/**
 * Validate the CSRF token on incoming requests.
 * Compares the X-CSRF-Token header with the cellex_csrftoken cookie.
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Only called for state-changing methods (POST, PUT, PATCH, DELETE).
 * GET and OPTIONS requests are exempt (they should be side-effect free).
 */
export function validateCsrf(request: NextRequest): boolean {
  // GET and OPTIONS don't need CSRF protection
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
    return true;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value || '';
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || '';

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    return false;
  }
}

/**
 * Middleware-style CSRF rejection response.
 */
export function csrfRejected(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'CSRF token validation failed' },
    { status: 403 }
  );
}
