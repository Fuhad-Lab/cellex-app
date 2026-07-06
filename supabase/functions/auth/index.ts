/// <reference lib="deno.ns" />
// Cellex Auth Edge Function (Session-Based — NO cookies, NO localStorage)
// -----------------------------------------------------------------------
// Auth tokens are stored IN SUPABASE (web_sessions table). The frontend only
// receives a session_id (a random UUID) which it keeps in memory.
//
// Flow:
//   1. login/signup → authenticate via Supabase Auth → store tokens in
//      web_sessions table → return { session_id, user } (NO tokens in response)
//   2. All other edge functions receive session_id → look up access_token in
//      web_sessions → use it to identify the user
//   3. logout → delete the session from web_sessions
//   4. session → look up session_id → return user info
//
// The frontend stores session_id in MEMORY ONLY (a JS variable).
// No localStorage, no cookies, no tokens in JavaScript.

import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts';

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
        return await handleLogout(body);
      case 'session':
        return await handleSession(body);
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

  // Step 3: Return ONLY session_id + user (NO tokens)
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

// ---- Logout ----

async function handleLogout(body: Record<string, unknown>): Promise<Response> {
  const sessionId = (body.session_id as string) || '';

  if (!sessionId) {
    return errorResponse('Missing session_id', 400);
  }

  // Delete the session from web_sessions
  await fetch(`${SUPABASE_URL}/rest/v1/web_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });

  return jsonResponse({ success: true });
}

// ---- Session Check ----

async function handleSession(body: Record<string, unknown>): Promise<Response> {
  const sessionId = (body.session_id as string) || '';

  if (!sessionId) {
    return jsonResponse({ success: true, user: null });
  }

  // Look up the session in web_sessions
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/web_sessions?select=access_token,expires_at,user_id&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    { headers: adminHeaders }
  );

  const sessions = await resp.json();

  if (!sessions || sessions.length === 0) {
    return jsonResponse({ success: true, user: null });
  }

  const session = sessions[0];

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    // Delete expired session
    await fetch(`${SUPABASE_URL}/rest/v1/web_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    return jsonResponse({ success: true, user: null });
  }

  // Verify the access token with Supabase Auth
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!userResp.ok) {
    return jsonResponse({ success: true, user: null });
  }

  const user = await userResp.json();
  return jsonResponse({ success: true, user });
}

// ---- Helper: Get user from session_id (used by other edge functions) ----

export async function getUserFromSession(sessionId: string): Promise<{ id: string; email?: string } | null> {
  if (!sessionId) return null;

  // Look up the session
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/web_sessions?select=access_token,expires_at&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    { headers: adminHeaders }
  );

  const sessions = await resp.json();

  if (!sessions || sessions.length === 0) return null;

  const session = sessions[0];

  // Check expiry
  if (new Date(session.expires_at) < new Date()) return null;

  // Verify the token and get user
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!userResp.ok) return null;

  const user = await userResp.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}
