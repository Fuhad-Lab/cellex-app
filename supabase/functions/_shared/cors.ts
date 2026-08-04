// Shared CORS headers for all edge functions.
// SECURITY: Restrict to allowed origins from env var, NOT wildcard '*'.
// This prevents any website from calling these endpoints from a user's browser.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Only allow the origin if it's in our allowlist
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Backward-compatible export (uses empty origin — safe default)
export const corsHeaders = getCorsHeaders(null);

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Get the user from a session_id.
 *
 * WEB BROWSER STRATEGY (HTTP-only cookies):
 * The web-server sends the session_id in the Authorization header as:
 *   Authorization: Bearer <session_id>
 *
 * This function:
 *   1. Extracts the session_id from the header
 *   2. Looks up the access_token in the web_sessions table
 *   3. Verifies the access_token with Supabase Auth
 *   4. Implements SLIDING EXPIRATION — extends the session on each request
 *      (60-day window resets on activity, like Meta's long-lived tokens)
 *   5. Returns the user object
 *
 * MOBILE NATIVE STRATEGY (OAuth 2.0):
 * Mobile clients send a short-lived access_token directly:
 *   Authorization: Bearer <access_token>
 * The token expires after 1 hour. The mobile client uses a refresh_token
 * (stored in OS-level secure storage) to get a new access_token via
 * /api/auth?op=refresh. See handleTokenRefresh in the edge function.
 *
 * NO cookies, NO localStorage — the session is stored IN SUPABASE.
 */
const SLIDING_EXPIRATION_DAYS = 60; // 60-day sliding window (like Meta)
const SLIDING_EXPIRATION_MS = SLIDING_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export async function getUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Look up the session in web_sessions by session_id
    const sessionResp = await fetch(
      `${supabaseUrl}/rest/v1/web_sessions?select=access_token,expires_at,user_id&session_id=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: adminHeaders }
    );

    const sessions = await sessionResp.json();

    // If no session found, try treating the token as a direct access_token
    // (mobile OAuth flow — short-lived tokens)
    if (!sessions || sessions.length === 0) {
      return await verifyAccessToken(token, supabaseUrl, serviceKey);
    }

    const session = sessions[0];

    // Step 2: Check if expired
    if (new Date(session.expires_at) < new Date()) return null;

    // Step 3: Verify the access_token with Supabase Auth
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!userResp.ok) return null;

    const user = await userResp.json();
    if (!user?.id) return null;

    // Step 4: SLIDING EXPIRATION — extend the session on each request.
    // This implements the 60-day sliding window: any activity resets the
    // expiration to 60 days from now. Inactive sessions expire naturally.
    const newExpiresAt = new Date(Date.now() + SLIDING_EXPIRATION_MS).toISOString();
    fetch(`${supabaseUrl}/rest/v1/web_sessions?session_id=eq.${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ expires_at: newExpiresAt }),
    }).catch(() => {}); // non-blocking — don't fail the request if extension fails

    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Verify a direct access token (mobile OAuth flow).
 * Short-lived tokens (1 hour) issued by Supabase Auth.
 */
async function verifyAccessToken(
  accessToken: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ id: string; email?: string } | null> {
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResp.ok) return null;

    const user = await userResp.json();
    return user?.id ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/**
 * Create a Supabase REST client using the service role key.
 * This bypasses RLS — use only in edge functions.
 */
export function supabaseRest() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return {
    url,
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Fetch data from a Supabase table via REST API.
 */
export async function supabaseSelect(
  table: string,
  select = '*',
  filters: Record<string, string> = {},
  options: { order?: string; ascending?: boolean; limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  const { url, headers } = supabaseRest();

  let query = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

  for (const [key, value] of Object.entries(filters)) {
    query += `&${key}=${encodeURIComponent(value)}`;
  }

  if (options.order) {
    query += `&order=${options.order}.${options.ascending ? 'asc' : 'desc'}`;
  }

  if (options.limit) {
    query += `&limit=${options.limit}`;
  }

  const resp = await fetch(query, { headers });

  if (!resp.ok) {
    console.error(`Supabase select error on ${table}: ${resp.status} ${await resp.text()}`);
    return [];
  }

  return await resp.json();
}

/**
 * Insert into a Supabase table via REST API.
 */
export async function supabaseInsert(
  table: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const { url, headers } = supabaseRest();

  const resp = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    console.error(`Supabase insert error on ${table}: ${resp.status} ${await resp.text()}`);
    return null;
  }

  const result = await resp.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Update a Supabase table via REST API.
 */
export async function supabaseUpdate(
  table: string,
  data: Record<string, unknown>,
  filters: Record<string, string>
): Promise<Record<string, unknown>[] | null> {
  const { url, headers } = supabaseRest();

  let query = `${url}/rest/v1/${table}?`;

  for (const [key, value] of Object.entries(filters)) {
    query += `&${key}=${encodeURIComponent(value)}`;
  }

  const resp = await fetch(query, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    console.error(`Supabase update error on ${table}: ${resp.status} ${await resp.text()}`);
    return null;
  }

  return await resp.json();
}

/**
 * Delete from a Supabase table via REST API.
 */
export async function supabaseDelete(
  table: string,
  filters: Record<string, string>
): Promise<boolean> {
  const { url, headers } = supabaseRest();

  let query = `${url}/rest/v1/${table}?`;

  for (const [key, value] of Object.entries(filters)) {
    query += `&${key}=${encodeURIComponent(value)}`;
  }

  const resp = await fetch(query, {
    method: 'DELETE',
    headers,
  });

  if (!resp.ok) {
    console.error(`Supabase delete error on ${table}: ${resp.status} ${await resp.text()}`);
    return false;
  }

  return true;
}
