/// <reference lib="deno.ns" />
// Cellex Auth Edge Function (HTTP-Only Cookie + Supabase Session Store)
// -----------------------------------------------------------------------
// Auth tokens (JWT) are stored IN SUPABASE (web_sessions table).
// The frontend receives NOTHING — just a user object.
// The session_id is stored in an HTTP-only cookie (set by the web-server)
// that JavaScript CANNOT read.
//
// Flow:
//   1. login/signup → authenticate via Supabase Auth → store JWT tokens in
//      web_sessions table → return { session_id, user }
//      (web-server sets session_id as HTTP-only cookie, strips it from response)
//   2. session → read session_id from Authorization header (forwarded from
//      cookie by web-server) → look up in web_sessions → verify JWT → return user
//   3. logout → read session_id from Authorization header → delete from web_sessions
//      (web-server clears the cookie)

import { corsHeaders, jsonResponse, errorResponse, getUser } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Generate a random session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract session_id from Authorization header (set by web-server from cookie)
function getSessionIdFromHeader(req: Request): string {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.replace('Bearer ', '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json();
    const { op } = body;

    switch (op) {
      case 'login':
        return await handleLogin(body);
      case 'signup':
        return await handleSignup(body);
      case 'logout':
        return await handleLogout(req);
      case 'session':
        return await handleSession(req);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Auth edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---- Login ----

async function handleLogin(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string) || '';
  const password = (body.password as string) || '';

  if (!email || !password) {
    return errorResponse('Missing email or password', 400);
  }

  // Step 1: Authenticate via Supabase Auth
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return jsonResponse({ success: false, error: data.error_description || data.error || 'Login failed' }, resp.status);
  }

  // Step 2: Create a session in the web_sessions table
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const sessionResp = await fetch(`${SUPABASE_URL}/rest/v1/web_sessions`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: data.user.id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    }),
  });

  if (!sessionResp.ok) {
    console.error('Failed to create session:', await sessionResp.text());
    return errorResponse('Failed to create session', 500);
  }

  // Step 3: Return session_id + user (web-server sets cookie with session_id)
  return jsonResponse({
    success: true,
    session_id: sessionId,
    user: data.user,
  });
}

// ---- Signup ----

async function handleSignup(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string) || '';
  const password = (body.password as string) || '';

  if (!email || !password) {
    return errorResponse('Missing email or password', 400);
  }

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return jsonResponse({ success: false, error: data.error_description || data.error || 'Signup failed' }, resp.status);
  }

  // If signup returned a session (auto-login), create a web_sessions record
  if (data.session?.access_token) {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${SUPABASE_URL}/rest/v1/web_sessions`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: data.user.id,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: expiresAt,
      }),
    });

    return jsonResponse({
      success: true,
      session_id: sessionId,
      user: data.user,
    });
  }

  // Email verification required — no session yet
  return jsonResponse({
    success: true,
    session_id: null,
    user: data.user,
    message: 'Please check your email for a verification link.',
  });
}

// ---- Logout (reads session_id from Authorization header) ----

async function handleLogout(req: Request): Promise<Response> {
  const sessionId = getSessionIdFromHeader(req);

  if (!sessionId) {
    return errorResponse('No session to logout', 400);
  }

  // Delete the session from web_sessions
  await fetch(`${SUPABASE_URL}/rest/v1/web_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });

  return jsonResponse({ success: true });
}

// ---- Session Check (reads session_id from Authorization header) ----

async function handleSession(req: Request): Promise<Response> {
  // getUser() reads the Authorization header, looks up session_id in
  // web_sessions, verifies the JWT, and returns the user
  const user = await getUser(req);

  if (!user) {
    return jsonResponse({ success: true, user: null });
  }

  return jsonResponse({ success: true, user });
}
