import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Feedback API — routes through the social Edge Function for Supabase writes.
 * Gorse feedback is sent directly (separate service).
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

  const { itemId, type, score, metadata } = body;
  if (!itemId || !type) {
    return NextResponse.json({ success: false, error: 'itemId and type required' }, { status: 400 });
  }

  // 1. Send to Gorse (non-blocking)
  let userId = 'anonymous';
  if (sessionId) {
    try {
      const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'session' }),
      });
      const authData = await authResp.json();
      if (authData.success && authData.user) userId = authData.user.id;
    } catch {}
  }

  const gorseTypeMap: Record<string, 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay'> = {
    like: 'like', unlike: 'skip', click: 'click', view: 'view',
    save: 'like', unsave: 'skip', purchase: 'purchase',
    skip: 'skip', replay: 'replay', comment: 'like', follow: 'like', add_to_cart: 'click', share: 'click',
  };
  sendGorseFeedback(userId, String(itemId), gorseTypeMap[type] || 'view', score);

  // 2. Write to Supabase via social Edge Function (non-blocking)
  if (userId !== 'anonymous' && sessionId) {
    fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'feedback_write', itemId, type, metadata }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  console.log(`[feedback] user=${userId} item=${itemId} type=${type} score=${score ?? 'default'}`);
  return NextResponse.json({ success: true, message: 'Feedback recorded' });
}
