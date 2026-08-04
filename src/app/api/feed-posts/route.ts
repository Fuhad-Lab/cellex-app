import { validateCsrf, csrfRejected } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Feed Posts API — routes through the social Edge Function.
 * Maps frontend op names to edge function op names.
 */
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) return csrfRejected();
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
    list: 'feed_post_list',
    create: 'feed_post_create',
    delete: 'feed_post_delete',
    mine: 'feed_post_list', // mine = list with sellerId (set below)
  };

  const edgeOp = opMap[body.op] || body.op;

  // For 'mine', we need to get the sellerId from the session
  let edgeBody: any = { ...body, op: edgeOp };
  if (body.op === 'mine') {
    // The edge function will use the session to determine sellerId
    // We need to pass sellerId — get it from seller-profile edge function
    if (sessionId) {
      try {
        const sellerResp = await fetch(`${EDGE_FUNCTIONS_URL}/seller-profile`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'get' }),
        });
        const sellerData = await sellerResp.json();
        if (sellerData.success && sellerData.seller) {
          edgeBody.sellerId = sellerData.seller.id;
        }
      } catch {}
    }
  }

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

    // Fire Gorse feedback on successful post creation
    if (body.op === 'create' && data.success && data.post && sessionId) {
      try { sendGorseFeedback(sessionId, `post:${data.post.id}`, 'like', 1); } catch {}
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error('[feed-posts] Edge function error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
