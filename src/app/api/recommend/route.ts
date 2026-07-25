import { NextRequest, NextResponse } from 'next/server';
import {
  getGorseRecommendations,
  getGorseItemNeighbors,
  sendGorseFeedback,
  GORSE_URL,
  fetchRealProductRankingFromSupabase,
  fetchRealVideoRankingFromSupabase,
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
 * Homepage Feed — PURELY Gorse-driven unified feed of videos + products.
 *
 * The feed is a single ranked list. Gorse decides the order. No hardcoded
 * interleave logic, no fixed video/product ratio. The frontend just renders
 * whatever Gorse returns, in that exact order.
 *
 * Item ID scheme (so Gorse sees videos and products as distinct items):
 *   "video:<id>"   e.g. "video:25"
 *   "product:<id>" e.g. "product:22"
 *
 * Strategy:
 *   1. Gorse (if configured) → collaborative filtering across both videos + products
 *   2. Real trending (Supabase engagement score) → cold-start fallback.
 *      Combines trending products + recent videos, ranked by real engagement.
 *
 * Response shape:
 *   { success, source, posts: [{ type: 'video'|'product', ...videoOrProductFields }] }
 */
async function handleHome(userId: string, limit: number) {
  const startTime = Date.now();
  const sources: string[] = [];

  // 1. Gorse — returns ranked item IDs like ["video:5","product:22","video:12",...]
  if (isGorseConfigured()) {
    const gorseIds = await getGorseRecommendations(userId, { limit });
    if (gorseIds.length > 0) {
      const posts = await hydrateUnifiedPosts(gorseIds);
      if (posts.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'gorse',
          posts,
          latencyMs: Date.now() - startTime,
        });
      }
    }
    sources.push('gorse:empty');
  } else {
    sources.push('gorse:not-configured');
  }

  // 2. Gorse item neighbors — for logged-in users with engagement history,
  //    find products SIMILAR to what they've viewed/liked (via pgvector).
  //    This provides REAL personalization even when Gorse recommendations fail.
  if (userId && userId !== 'anonymous') {
    const personalizedIds = await getPersonalizedProductIds(userId, limit);
    if (personalizedIds.length > 0) {
      const posts = await hydrateUnifiedPosts(personalizedIds.map(id => `product:${id}`));
      if (posts.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'pgvector-personalized',
          posts,
          latencyMs: Date.now() - startTime,
          debug: { sourcesTried: sources },
        });
      }
    }
    sources.push('pgvector:no-history');
  }

  // 3. Cold-start fallback — real trending across both videos AND products.
  //    Shuffle the results so the user sees VARIETY (not the same products
  //    every time). Deduplicate by product/post ID.
  const trendingPosts = await fetchRealTrendingUnified(limit * 2);
  if (trendingPosts.length > 0) {
    // Deduplicate by post ID (no duplicates in the feed)
    const seen = new Set<string>();
    const deduped = trendingPosts.filter((p: any) => {
      const key = `${p.type}-${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Shuffle for variety (deterministic per user so refresh is stable within a session)
    const seed = userId ? hashString(userId) : Date.now();
    const shuffled = seededShuffle(deduped, seed);

    return NextResponse.json({
      success: true,
      source: 'trending-real',
      posts: shuffled.slice(0, limit),
      latencyMs: Date.now() - startTime,
      debug: { sourcesTried: sources },
    });
  }

  // 4. Last resort — empty (no fake/hardcoded list)
  return NextResponse.json({
    success: true,
    source: 'empty',
    posts: [],
    latencyMs: Date.now() - startTime,
    debug: { sourcesTried: sources },
  });
}

/**
 * Get personalized product IDs using pgvector similarity.
 * Finds products similar to what the user has viewed/liked/saved.
 * Uses the user's engagement history (product_view_log, buyers_wishlist, buyers_reviews)
 * to find their interests, then queries pgvector for similar products.
 */
async function getPersonalizedProductIds(userId: string, limit: number): Promise<string[]> {
  const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
  const PROJECT = process.env.SUPABASE_PROJECT || 'tcwdbokruvlizkxcpkzj';
  if (!SUPABASE_TOKEN || !userId || userId === 'anonymous') return [];

  const safeUserId = userId.replace(/'/g, "''");

  try {
    // Get the user's engaged products + their embeddings, then find SIMILAR products
    // using pgvector cosine similarity. This is REAL personalization.
    const query = `
      WITH user_products AS (
        SELECT product_id FROM product_view_log WHERE user_id = '${safeUserId}'::uuid
        UNION
        SELECT product_id FROM buyers_wishlist WHERE user_id = '${safeUserId}'::uuid
        UNION
        SELECT product_id FROM buyers_reviews WHERE user_id = '${safeUserId}'::uuid
      ),
      user_embeddings AS (
        SELECT e.embedding, e.product_id
        FROM product_embeddings e
        INNER JOIN user_products up ON up.product_id = e.product_id
        LIMIT 10
      )
      SELECT DISTINCT sim.product_id::text AS id
      FROM user_embeddings ue
      CROSS JOIN LATERAL (
        SELECT e.product_id, e.embedding <=> ue.embedding AS dist
        FROM product_embeddings e
        WHERE e.product_id NOT IN (SELECT product_id FROM user_products)
        ORDER BY e.embedding <=> ue.embedding
        LIMIT 5
      ) sim
      ORDER BY sim.dist
      LIMIT ${limit};
    `.trim();

    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-recommend',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => String(r.id)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Simple string hash for deterministic shuffling (same user = same order).
 */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Seeded shuffle — deterministic per seed so the same user sees the same
 * order on refresh, but different users see different orders.
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let rng = seed;
  for (let i = result.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Hydrate a list of prefixed item IDs ("video:5", "product:22") into a unified
 * posts array. Preserves the order Gorse returned (most relevant first).
 * Skips any IDs that don't parse or can't be hydrated.
 */
async function hydrateUnifiedPosts(itemIds: string[]): Promise<any[]> {
  if (!itemIds.length) return [];

  // Parse prefixes, group by type
  const videoIds: string[] = [];
  const productIds: string[] = [];
  const idOrder: Array<{ type: 'video' | 'product'; id: string }> = [];

  for (const raw of itemIds) {
    const s = String(raw);
    if (s.startsWith('video:')) {
      const id = s.slice(6);
      videoIds.push(id);
      idOrder.push({ type: 'video', id });
    } else if (s.startsWith('product:')) {
      const id = s.slice(8);
      productIds.push(id);
      idOrder.push({ type: 'product', id });
    } else if (/^\d+$/.test(s)) {
      // Legacy: bare numeric IDs — assume product (backward compat with
      // existing Gorse feedback that wasn't prefixed)
      productIds.push(s);
      idOrder.push({ type: 'product', id: s });
    }
    // Unknown prefix — skip
  }

  // Hydrate videos and products in parallel
  const [videos, products] = await Promise.all([
    videoIds.length ? hydrateVideos(videoIds) : Promise.resolve([]),
    productIds.length ? hydrateProducts(productIds) : Promise.resolve([]),
  ]);

  // Build lookup maps
  const videoMap = new Map(videos.map((v: any) => [String(v.id), v]));
  const productMap = new Map(products.map((p: any) => [String(p.id), p]));

  // Build unified posts array in Gorse's order
  const posts: any[] = [];
  for (const { type, id } of idOrder) {
    if (type === 'video') {
      const v = videoMap.get(id);
      if (v) posts.push({ type: 'video', ...v });
    } else {
      const p = productMap.get(id);
      if (p) posts.push({ type: 'product', ...p });
    }
  }
  return posts;
}

/**
 * Cold-start fallback: fetch trending products + recent videos from Supabase,
 * rank them together by real engagement score, return as a unified posts array.
 *
 * Engagement score (same formula for both types, normalized):
 *   products: units_sold*4 + views*0.5 + wishlist*3 + reviews*2 + recency
 *   videos:   views_count*0.5 + likes_count*1 + comments_count*2 + recency
 */
async function fetchRealTrendingUnified(limit: number): Promise<any[]> {
  // Fetch trending products and recent videos in parallel
  const [productRows, videoRows] = await Promise.all([
    fetchRealProductRankingFromSupabase(limit),
    fetchRealVideoRankingFromSupabase(limit),
  ]);

  // Build unified ranked list
  type Item = { type: 'video' | 'product'; id: string; score: number; data: any };
  const items: Item[] = [];

  for (const r of productRows) {
    items.push({ type: 'product', id: r.id, score: r.score, data: r });
  }
  for (const r of videoRows) {
    items.push({ type: 'video', id: r.id, score: r.score, data: r });
  }

  // Sort by score descending
  items.sort((a, b) => b.score - a.score);

  // Take top `limit`
  const top = items.slice(0, limit);

  // Hydrate
  const productIds = top.filter((t) => t.type === 'product').map((t) => t.id);
  const videoIds = top.filter((t) => t.type === 'video').map((t) => t.id);
  const [products, videos] = await Promise.all([
    productIds.length ? hydrateProducts(productIds) : Promise.resolve([]),
    videoIds.length ? hydrateVideos(videoIds) : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((p: any) => [String(p.id), p]));
  const videoMap = new Map(videos.map((v: any) => [String(v.id), v]));

  // Build posts in ranked order
  const posts: any[] = [];
  for (const t of top) {
    if (t.type === 'product') {
      const p = productMap.get(t.id);
      if (p) {
        posts.push({
          type: 'product',
          ...p,
          _engagement_score: t.score,
          _views_count: t.data.views_count || 0,
        });
      }
    } else {
      const v = videoMap.get(t.id);
      if (v) {
        posts.push({
          type: 'video',
          ...v,
          _engagement_score: t.score,
        });
      }
    }
  }
  return posts;
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
        query: `SELECT v.id, v.video_url, v.caption, v.views_count, v.likes_count, v.created_at, v.product_id, v.seller_id, p.name as product_name, p.price, p.image_url, s.business_name as seller_name, s.profile_image as seller_image, s.slug as seller_slug FROM product_videos v LEFT JOIN products p ON v.product_id = p.id LEFT JOIN sellers s ON v.seller_id = s.id WHERE v.id IN (${ids});`,
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
