/**
 * Generic edge function proxy — used by all API routes.
 * Reads the session cookie, forwards to the Supabase edge function,
 * and returns the response.
 *
 * SECURITY: The Supabase URL and anon key are read STRICTLY from environment
 * variables. There are NO hardcoded fallbacks — if the env vars are missing,
 * the server fails loudly. This ensures the edge function URL is NEVER
 * exposed in the frontend bundle (it lives only in Render env vars).
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf, csrfRejected } from '@/lib/csrf';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COOKIE_NAME = 'cellex_session_id';

function getConfig() {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY environment variable is not set');
  }
  return {
    edgeFunctionsUrl: `${SUPABASE_URL}/functions/v1`,
    anonKey: SUPABASE_ANON_KEY,
  };
}

export async function proxyToEdgeFunction(edgeName: string, request: NextRequest) {
  let config;
  try {
    config = getConfig();
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // CSRF validation — reject state-changing requests without valid token.
  // The auth route (/api/auth) handles its own CSRF since it sets the cookie.
  // All other routes must validate.
  if (!validateCsrf(request)) {
    return csrfRejected();
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  const body = await request.text();

  const headers: Record<string, string> = {
    'apikey': config.anonKey,
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
    const resp = await fetch(`${config.edgeFunctionsUrl}/${edgeName}`, {
      method: 'POST',
      headers,
      body,
    });

    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: resp.status });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid response from server' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }
}

/**
 * Get the edge function URL — for route handlers that need to call
 * edge functions directly (not via proxyToEdgeFunction).
 * Throws if SUPABASE_URL is not set (no silent fallback).
 */
export function getEdgeFunctionsUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  return `${SUPABASE_URL}/functions/v1`;
}

/**
 * Get the Supabase anon key — for route handlers that need it.
 * Throws if not set.
 */
export function getSupabaseAnonKey(): string {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY environment variable is not set');
  }
  return SUPABASE_ANON_KEY;
}

/**
 * Get the session ID from a request cookie.
 */
export function getSessionId(request: NextRequest): string {
  return request.cookies.get(COOKIE_NAME)?.value || '';
}
