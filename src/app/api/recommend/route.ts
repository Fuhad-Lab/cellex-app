import { NextRequest, NextResponse } from 'next/server';
import {
  getGorseRecommendations,
  getGorseItemNeighbors,
  sendGorseFeedback,
  GORSE_URL,
  fetchRealProductRankingFromSupabase,
  upsertProductToChroma,
  deleteProductFromChroma,
} from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Recommendation API — Gorse-powered recommendations.
 *
 * POST /api/recommend
 * Body: {
 *   op: 'home' | 'category' | 'shorts' | 'neighbors' | 'feedback'
 *             | 'product_embed' | 'product_delete',
 *   userId?: string,
 *   category?: string,
 *   itemId?: string,
 *   limit?: number,
 *   feedback?: { itemId, type, score? },
 *   product?: { id, name, category, description, price, image_url },  // for product_embed
 *   productId?: string | number,                                      // for product_delete
 * }
 *
 * Architecture (clear separation of concerns):
 *   - Gorse  → recommendations (this route). Collaborative filtering across all users.
 *   - Chroma → semantic search (the /api/smart-search route). Not used here.
 *
 * Fallback: when Gorse returns nothing (cold-start: new user, new item, or Gorse
 * temporarily down), fall back to REAL trending from Supabase — computed from
 * units_sold, view_count, wishlist_count, review_count. No fake math.
 *
 * The `source` field in the response tells you which path was used.
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

  // === AUTH ===
  let userId = '';
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

  const effectiveUserId = body.userId || userId || 'anonymous';

  switch (body.op) {
    case 'home':            return await handleHome(effectiveUserId, body.limit || 20);
    case 'category':        return await handleCategory(effectiveUserId, body.category || '', body.limit || 30);
    case 'shorts':          return await handleShorts(effectiveUserId, body.limit || 15);
    case 'neighbors':       return await handleNeighbors(body.itemId || '', body.limit || 10);
    case 'feedback':        return await handleFeedback(effectiveUserId, body.feedback);
    case 'product_embed':   return await handleProductEmbed(body.product);
    case 'product_delete':  return await handleProductDelete(body.productId);
    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}

/**
 * Is Gorse actually configured? GORSE_URL defaults to localhost, which means
 * "not configured" in production. Treat that as "Gorse off" instead of trying
 * to hit localhost and timing out.
 */
function isGorseConfigured(): boolean {
  return !!GORSE_URL && !GORSE_URL.startsWith('http://localhost');
}

/**
 * Homepage Feed — Gorse recommendations, with real-trending fallback.
 *
 *   1. Gorse (if configured) → collaborative filtering
 *   2. Real trending (Supabase engagement score) → cold-start fallback
 */
async function handleHome(userId: string, limit: number) {
  const startTime = Date.now();
  const sources: string[] = [];

  // 1. Gorse
  if (isGorseConfigured()) {
    const gorseIds = await getGorseRecommendations(userId, { limit });
    if (gorseIds.length > 0) {
      const hydrated = await hydrateProducts(gorseIds);
      if (hydrated.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'gorse',
          products: hydrated,
          latencyMs: Date.now() - startTime,
        });
      }
    }
    sources.push('gorse:empty');
  } else {
    sources.push('gorse:not-configured');
  }

  // 2. Real trending — Supabase engagement score
  //    (units_sold*4 + views*0.5 + wishlist*3 + reviews*2 + recency bonus)
  //    Used for cold-start: new users, new items, or Gorse temporarily empty.
  const ranked = await fetchRealProductRankingFromSupabase(limit);
  if (ranked.length > 0) {
    const hydrated = await hydrateProducts(ranked.map((r) => r.id));
    const scoreMap = new Map(ranked.map((r) => [r.id, r]));
    const enriched = hydrated.map((p: any) => ({
      ...p,
      _engagement_score: scoreMap.get(String(p.id))?.score || 0,
      _views_count: scoreMap.get(String(p.id))?.views_count || 0,
    }));
    return NextResponse.json({
      success: true,
      source: 'trending-real',
      products: enriched,
      latencyMs: Date.now() - startTime,
      debug: { sourcesTried: sources },
    });
  }

  // 3. Last resort — empty (no fake/hardcoded list)
  return NextResponse.json({
    success: true,
    source: 'empty',
    products: [],
    latencyMs: Date.now() - startTime,
    debug: { sourcesTried: sources },
  });
}

/**
 * Category Page Feed — Gorse category-aware recommendations
 * with real-trending-in-category fallback.
 */
async function handleCategory(userId: string, category: string, limit: number) {
  const startTime = Date.now();

  if (isGorseConfigured()) {
    const gorseIds = await getGorseRecommendations(userId, { category, limit });
    if (gorseIds.length > 0) {
      const hydrated = await hydrateProducts(gorseIds);
      if (hydrated.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'gorse',
          products: hydrated,
          latencyMs: Date.now() - startTime,
        });
      }
    }
  }

  // Real trending within this category
  const ranked = await fetchRealProductRankingFromSupabase(limit * 3);
  if (ranked.length > 0) {
    const hydrated = await hydrateProducts(ranked.map((r) => r.id));
    const scoreMap = new Map(ranked.map((r) => [r.id, r]));
    const filtered = hydrated
      .filter((p: any) => (p.category || '').toLowerCase() === (category || '').toLowerCase())
      .map((p: any) => ({
        ...p,
        _engagement_score: scoreMap.get(String(p.id))?.score || 0,
      }))
      .slice(0, limit);
    if (filtered.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'category-trending-real',
        products: filtered,
        latencyMs: Date.now() - startTime,
      });
    }
  }

  return NextResponse.json({
    success: true,
    source: 'empty',
    products: [],
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Shorts Page Feed — Gorse-powered video recommendations,
 * with real Supabase video feed as cold-start fallback.
 */
async function handleShorts(userId: string, limit: number) {
  const startTime = Date.now();

  if (isGorseConfigured()) {
    const gorseIds = await getGorseRecommendations(userId, { limit });
    if (gorseIds.length > 0) {
      const hydrated = await hydrateVideos(gorseIds);
      if (hydrated.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'gorse',
          videos: hydrated,
          latencyMs: Date.now() - startTime,
        });
      }
    }
  }

  // Fallback: real Supabase video feed (ranked by recency)
  const fallbackResp = await fetch(`${EDGE_FUNCTIONS_URL}/videos`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'feed', limit }),
  }).then((r) => r.json()).catch(() => ({ success: false }));

  return NextResponse.json({
    ...fallbackResp,
    source: 'videos-feed-real',
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Product Detail "Users Also Viewed" — Gorse item-to-item neighbors.
 * (If Gorse is empty, returns empty — do NOT fake this with Chroma.)
 */
async function handleNeighbors(itemId: string, limit: number) {
  const startTime = Date.now();

  if (isGorseConfigured()) {
    const neighborIds = await getGorseItemNeighbors(itemId, limit);
    if (neighborIds.length > 0) {
      const hydrated = await hydrateProducts(neighborIds);
      if (hydrated.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'gorse',
          products: hydrated,
          latencyMs: Date.now() - startTime,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    source: 'empty',
    products: [],
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Feedback Sync — non-blocking, fires to Gorse in background
 */
async function handleFeedback(userId: string, feedback: any) {
  if (!feedback || !feedback.itemId || !feedback.type) {
    return NextResponse.json({ success: false, error: 'Missing feedback fields' }, { status: 400 });
  }

  sendGorseFeedback(userId, feedback.itemId, feedback.type, feedback.score);

  return NextResponse.json({
    success: true,
    message: 'Feedback received',
  });
}

/**
 * Incremental Chroma sync — embed a product on create/update.
 * Called by /api/seller-products when a seller creates/edits a product.
 *
 * Note: this is the ONLY place Chroma intersects with the recommend route,
 * and it's just for keeping the search index fresh. Recommendations still
 * come from Gorse, not Chroma.
 */
async function handleProductEmbed(product: any) {
  if (!product || !product.id) {
    return NextResponse.json({ success: false, error: 'Missing product.id' }, { status: 400 });
  }

  upsertProductToChroma(product.id, product).then((ok) => {
    if (!ok) console.warn(`[recommend] product_embed failed for ${product.id}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Embedding queued',
    productId: product.id,
  });
}

/**
 * Incremental Chroma sync — delete a product's embedding on product delete.
 */
async function handleProductDelete(productId: string | number) {
  if (!productId) {
    return NextResponse.json({ success: false, error: 'Missing productId' }, { status: 400 });
  }

  deleteProductFromChroma(productId).then((ok) => {
    if (!ok) console.warn(`[recommend] product_delete failed for ${productId}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Delete queued',
    productId,
  });
}

/**
 * Hydrate product IDs with full product data from Supabase.
 */
async function hydrateProducts(productIds: string[]): Promise<any[]> {
  if (!productIds.length) return [];

  const sqlHeaders: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };

  try {
    const ids = productIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: sqlHeaders,
      body: JSON.stringify({
        query: `SELECT id, name, price, image_url, category, seller_id, units_sold, description, created_at FROM products WHERE id IN (${ids});`,
      }),
    });

    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    const productMap = new Map(data.map((p: any) => [String(p.id), p]));
    return productIds
      .map((id) => productMap.get(id))
      .filter(Boolean);
  } catch (err) {
    console.error('[recommend] hydrateProducts failed:', err);
    return [];
  }
}

/**
 * Hydrate video IDs with full video data from Supabase.
 */
async function hydrateVideos(videoIds: string[]): Promise<any[]> {
  if (!videoIds.length) return [];

  const sqlHeaders: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };

  try {
    const ids = videoIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: sqlHeaders,
      body: JSON.stringify({
        query: `SELECT v.id, v.video_url, v.caption, v.views_count, v.likes_count, v.created_at, v.product_id, p.name as product_name, p.price, p.image_url, s.business_name as seller_name, s.profile_image as seller_image FROM videos v LEFT JOIN products p ON v.product_id = p.id LEFT JOIN sellers s ON v.seller_id = s.id WHERE v.id IN (${ids});`,
      }),
    });

    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    const videoMap = new Map(data.map((v: any) => [String(v.id), v]));
    return videoIds
      .map((id) => videoMap.get(id))
      .filter(Boolean);
  } catch (err) {
    console.error('[recommend] hydrateVideos failed:', err);
    return [];
  }
}
