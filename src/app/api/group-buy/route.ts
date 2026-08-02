import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Group Buy API — proxies through the social Edge Function.
 *
 * The social edge function uses SUPABASE_SERVICE_ROLE_KEY (valid) and the
 * REST API, so it works even when the Supabase management API token
 * (SUPABASE_TOKEN) is missing or expired.
 *
 * Operations:
 *   - enable:   Seller enables group buy for a product (sets target + discount)
 *   - disable:  Seller disables group buy for a product
 *   - start:    Buyer starts a new group buy for a product (creates invite link + messenger conversation)
 *   - join:     Buyer joins an existing group buy via invite code (auto-adds to messenger conversation)
 *   - status:   Get status of a group buy (public)
 *   - invite:   Get group buy by invite code (public — for share-link landing page)
 *   - mine:     Get group buys the user has joined
 */

// Map frontend op names to edge function op names
const OP_MAP: Record<string, string> = {
  enable: 'group_buy_enable',
  disable: 'group_buy_disable',
  start: 'group_buy_start',
  join: 'group_buy_join',
  status: 'group_buy_status',
  invite: 'group_buy_invite',
  mine: 'group_buy_mine',
  // Legacy aliases (kept for backward compatibility)
  create: 'group_buy_start',
  active: 'group_buy_status',
  open: 'group_buy_status',
};

export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const edgeOp = OP_MAP[body.op] || body.op;
  const edgeBody = { ...body, op: edgeOp };

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
      signal: AbortSignal.timeout(15000),
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: 'Invalid response', raw: text }; }
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('[group-buy] Edge function error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
