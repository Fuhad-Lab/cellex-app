import { validateCsrf, csrfRejected } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Messenger API — E2E encrypted messaging
 *
 * Messages are encrypted client-side with AES-GCM (Web Crypto API).
 * The server only stores encrypted_content + IV — it can NEVER read messages.
 *
 * This route proxies through the social Edge Function (which uses
 * SUPABASE_SERVICE_ROLE_KEY and the REST API). This is necessary because
 * the previous SQL API approach (via SUPABASE_TOKEN management API) is
 * broken when the token is expired or missing.
 *
 * Operations:
 *   - list:       Get all conversations for the authenticated user
 *   - messages:   Get all messages in a conversation
 *   - send:       Send an encrypted message
 *   - create:     Create or get an existing conversation with another user
 */

const OP_MAP: Record<string, string> = {
  list: 'messenger_list',
  messages: 'messenger_messages',
  send: 'messenger_send',
  create: 'messenger_create',
  unread: 'messenger_unread',
};

export async function POST(request: NextRequest) {
  const _sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (_sessionId && !validateCsrf(request)) return csrfRejected();
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const edgeOp = OP_MAP[body.op];
  if (!edgeOp) {
    return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json',
  };

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, op: edgeOp }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: 'Invalid response', raw: text }; }
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('[messenger] Edge function error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
