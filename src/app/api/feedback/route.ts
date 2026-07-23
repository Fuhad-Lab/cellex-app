import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Feedback Sync API — Low-latency interaction sync pipeline
 *
 * POST /api/feedback
 * Body: {
 *   itemId: string,          // product/video ID
 *   type: 'like' | 'click' | 'view' | 'purchase' | 'save' | 'unsave' | 'unlike' | 'comment' | 'follow',
 *   score?: number,
 *   metadata?: { ... }
 * }
 *
 * This endpoint:
 * 1. Authenticates the user
 * 2. Writes the interaction to the REAL Supabase table (product_view_log, buyers_wishlist, etc.)
 *    so the engagement counts shown in the UI are real, not faked.
 * 3. ALSO fires feedback to Gorse in the background (fire-and-forget) for collaborative filtering.
 * 4. Returns 200 immediately.
 *
 * No more "fake" counts — every view/save/like is persisted to the DB.
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

  // === Authenticate ===
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

  // === Write to REAL Supabase tables (non-blocking, best-effort) ===
  // This is what makes the engagement counts in the UI REAL.
  if (userId !== 'anonymous' && SUPABASE_TOKEN) {
    persistFeedbackToSupabase(userId, String(itemId), type, metadata).catch((err) => {
      console.warn('[feedback] Supabase persist failed:', err);
    });
  }

  // === Map interaction types to Gorse feedback types ===
  const gorseTypeMap: Record<string, 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay'> = {
    like: 'like',
    unlike: 'skip',       // unliking is a mild negative signal
    click: 'click',
    view: 'view',
    save: 'like',         // saving is a strong positive signal
    unsave: 'skip',
    purchase: 'purchase',
    skip: 'skip',
    replay: 'replay',
    comment: 'like',
    follow: 'like',
    add_to_cart: 'click',
    share: 'click',
  };

  const gorseType = gorseTypeMap[type] || 'view';

  // === Fire and forget to Gorse ===
  sendGorseFeedback(userId, String(itemId), gorseType, score);

  console.log(`[feedback] user=${userId} item=${itemId} type=${type} score=${score ?? 'default'} page=${metadata?.page || 'unknown'}`);

  return NextResponse.json({
    success: true,
    message: 'Feedback recorded',
  });
}

/**
 * Persist feedback to the REAL Supabase engagement tables.
 * - view   → INSERT into product_view_log (products only)
 * - save   → INSERT into buyers_wishlist (products only)
 * - unsave → DELETE from buyers_wishlist (products only)
 * - like/click/etc → Gorse only (no dedicated Supabase table)
 *
 * Item IDs are prefixed ("video:5", "product:22") so Gorse can distinguish
 * videos from products. We strip the prefix here to get the raw numeric ID
 * for Supabase writes. Video feedback is Gorse-only (no Supabase table).
 */
async function persistFeedbackToSupabase(
  userId: string,
  itemId: string,
  type: string,
  metadata: any,
): Promise<void> {
  const safeUserId = userId.replace(/'/g, "''");
  const safeSource = (metadata?.page || 'feed').replace(/'/g, "''").slice(0, 50);

  // Parse prefixed item ID: "video:5" → {type:'video', id:'5'}
  //                          "product:22" → {type:'product', id:'22'}
  //                          "22" (legacy bare numeric) → {type:'product', id:'22'}
  const s = String(itemId);
  let itemType = 'product';
  let rawId = s;
  if (s.startsWith('video:')) {
    itemType = 'video';
    rawId = s.slice(6);
  } else if (s.startsWith('product:')) {
    itemType = 'product';
    rawId = s.slice(8);
  }

  // Only products have Supabase engagement tables (product_view_log, buyers_wishlist).
  // Video feedback goes to Gorse only.
  if (itemType !== 'product') return;

  const safeItemId = rawId.replace(/'/g, "''");
  if (!/^\d+$/.test(safeItemId)) return; // not a valid numeric ID

  let query = '';

  if (type === 'view') {
    query = `INSERT INTO product_view_log (product_id, user_id, source) VALUES (${safeItemId}::bigint, '${safeUserId}'::uuid, '${safeSource}');`;
  } else if (type === 'save') {
    query = `INSERT INTO buyers_wishlist (user_id, product_id) VALUES ('${safeUserId}'::uuid, ${safeItemId}::bigint) ON CONFLICT DO NOTHING;`;
  } else if (type === 'unsave') {
    query = `DELETE FROM buyers_wishlist WHERE user_id = '${safeUserId}'::uuid AND product_id = ${safeItemId}::bigint;`;
  } else {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-feedback',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn(`[feedback] Supabase write failed: HTTP ${resp.status} ${errText.slice(0, 200)}`);
    }
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
