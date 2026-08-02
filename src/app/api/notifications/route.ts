import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Notifications API — routes through the social Edge Function.
 * Maps frontend op names to edge function op names.
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }

  // Map frontend ops to edge function ops
  const opMap: Record<string, string> = {
    list: 'notifications_list',
    mark_read: 'notifications_mark_read',
    mark_all_read: 'notifications_mark_all_read',
    unread_count: 'notifications_unread_count',
  };

  const edgeBody = { ...body, op: opMap[body.op] || body.op };

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json',
  };

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify(edgeBody),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('[notifications] Edge function error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
