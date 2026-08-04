// Shared CORS headers for all edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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
 * The web-server sends the session_id in the Authorization header as:
 *   Authorization: Bearer <session_id>
 *
 * This function:
 *   1. Extracts the session_id from the header
 *   2. Looks up the access_token in the web_sessions table
 *   3. Verifies the access_token with Supabase Auth
 *   4. Returns the user object
 *
 * NO cookies, NO localStorage — the session is stored IN SUPABASE.
 */
export async function getUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const sessionId = authHeader.replace('Bearer ', '');

  if (!sessionId) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Look up the session in web_sessions
    const sessionResp = await fetch(
      `${supabaseUrl}/rest/v1/web_sessions?select=access_token,expires_at&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`,
      { headers: adminHeaders }
    );

    const sessions = await sessionResp.json();

    if (!sessions || sessions.length === 0) return null;

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
