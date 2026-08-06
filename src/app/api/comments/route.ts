import { validateCsrf, csrfRejected } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Comments API — routes through the social Edge Function.
 * Maps frontend op names to edge function op names.
 */
export async function POST(request: NextRequest) {
  const _sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (_sessionId && !validateCsrf(request)) return csrfRejected();
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Map frontend ops to edge function ops
  const opMap: Record<string, string> = {
    list: 'comment_list',
    create: 'comment_create',
    delete: 'comment_delete',
  };

  const edgeBody = { ...body, op: opMap[body.op] || body.op };

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify(edgeBody),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();

    // Fire Gorse feedback on comment creation
    if (body.op === 'create' && data.success && sessionId) {
      try { sendGorseFeedback(sessionId, String(body.postId), 'like', 0.8); } catch {}
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('[comments] Edge function error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
