import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Feedback Sync API — Low-latency interaction sync pipeline
 * 
 * POST /api/feedback
 * Body: {
 *   itemId: string,          // product/video ID
 *   type: 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay' | 'comment' | 'follow',
 *   score?: number,          // optional custom score
 *   metadata?: {             // optional context
 *     duration?: number,     // watch time in seconds (for videos)
 *     comment?: string,      // comment text
 *     page?: string,         // which page the interaction happened on
 *   }
 * }
 * 
 * This endpoint is NON-BLOCKING:
 * 1. Authenticates the user
 * 2. Fires feedback to Gorse in the background (fire-and-forget)
 * 3. Returns 200 immediately (< 50ms response time)
 * 
 * The user's next page refresh will feel dynamically alive because
 * Gorse has already updated their recommendation vectors.
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

  // === Authenticate (fast — just get userId) ===
  let userId = 'anonymous';
  if (sessionId) {
    try {
      const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: 'session' }),
      });
      const authData = await authResp.json();
      if (authData.success && authData.user) {
        userId = authData.user.id;
      }
    } catch {}
  }

  // === Map interaction types to Gorse feedback types ===
  const gorseTypeMap: Record<string, 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay'> = {
    like: 'like',
    click: 'click',
    view: 'view',
    purchase: 'purchase',
    skip: 'skip',
    replay: 'replay',
    comment: 'like',      // comments count as positive engagement
    follow: 'like',       // follows count as positive engagement
    add_to_cart: 'click', // cart adds count as clicks
    share: 'click',       // shares count as clicks
  };

  const gorseType = gorseTypeMap[type] || 'view';

  // === Fire and forget — don't block the response ===
  sendGorseFeedback(userId, String(itemId), gorseType, score);

  // === Log for analytics (optional, non-blocking) ===
  console.log(`[feedback] user=${userId} item=${itemId} type=${type} score=${score ?? 'default'} page=${metadata?.page || 'unknown'}`);

  return NextResponse.json({
    success: true,
    message: 'Feedback recorded',
  });
}
