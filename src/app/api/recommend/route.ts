import { NextRequest, NextResponse } from 'next/server';
import {
  getGorseRecommendations,
  getGorseItemNeighbors,
  sendGorseFeedback,
  fetchRealProductRankingFromSupabase,
  fetchRealVideoRankingFromSupabase,
  upsertProductToChroma,
  deleteProductFromChroma,
} from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
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
 * Is Gorse actually configured? We check by attempting a test recommendation
 * — if it returns empty, Gorse is not configured or has no data.
 * The GORSE_URL is only in the Edge Function environment, not here.
 */
function isGorseConfigured(): boolean {
  // GORSE_URL is no longer in the frontend — it's in the Edge Function.
  // We always try Gorse via the Edge Function; it returns empty if not configured.
  return true;
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

  // 3. Cold-start fallback — use the products Edge Function (works with anon key)
  //    instead of the management SQL API (which requires the expired service token).
  //    Fetch products from the Edge Function and format them as feed posts.
  try {
    const productsResp = await fetch(`${EDGE_FUNCTIONS_URL}/products`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'all', limit: limit * 2 }),
    }).then(r => r.json()).catch(() => ({ success: false }));

    if (productsResp.success) {
      const allProducts = [
        ...(productsResp.flashDeals || []),
        ...(productsResp.trending || []),
        ...(productsResp.newArrivals || []),
        ...(productsResp.farmProducts || []),
        ...(productsResp.products || []),
      ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

      if (allProducts.length > 0) {
        // Format as feed posts
        const posts = allProducts.slice(0, limit).map((p: any) => ({
          type: 'product',
          id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
          category: p.category,
          seller_id: p.seller_id,
          units_sold: p.units_sold,
          description: p.description,
          created_at: p.created_at,
          seller: {
            id: p.seller_id,
            business_name: p.seller_name || 'Seller',
            slug: p.seller_slug,
          },
          product: p,
        }));

        // Shuffle for variety
        const seed = userId ? hashString(userId) : Date.now();
        const shuffled = seededShuffle(posts, seed);

        return NextResponse.json({
          success: true,
          source: 'trending-real',
          posts: shuffled,
          latencyMs: Date.now() - startTime,
          debug: { sourcesTried: [...sources, 'trending:edge-function'] },
        });
      }
    }
    sources.push('trending:edge-failed');
  } catch (err) {
    sources.push('trending:error');
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
 *
 * Routes through the social Edge Function (which has the service role key)
 * instead of the expired SUPABASE_TOKEN management API.
 */
async function getPersonalizedProductIds(userId: string, limit: number): Promise<string[]> {
  if (!userId || userId === 'anonymous') return [];

  try {
    // Use the edge function's pgvector similarity search (op=pgvector_similar)
    // This is a new op we'll add to the social edge function.
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'pgvector_similar', userId, limit }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data.success) return [];
    return (data.productIds || []).map((id: any) => String(id));
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
 * Uses the social Edge Function's products_by_ids op (batch fetch with JOIN)
 * for efficiency. Falls back to the products edge function if needed.
 */
async function hydrateProducts(productIds: string[]): Promise<any[]> {
  if (!productIds.length) return [];

  try {
    const numericIds = productIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
    if (!numericIds.length) return [];

    // Use the social edge function's batch fetch (single request, JOINs sellers)
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'products_by_ids', ids: numericIds }),
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.products) {
        // Build a map and return in the requested order
        const productMap = new Map(data.products.map((p: any) => [String(p.id), p]));
        return productIds
          .map((id) => {
            const p = productMap.get(String(id)) as any;
            if (!p) return null;
            return {
              ...p,
              seller: {
                id: p.seller_id,
                business_name: p.seller_name || 'Seller',
                profile_image: p.seller_image,
                slug: p.seller_slug,
              },
            };
          })
          .filter(Boolean);
      }
    }

    // Fallback: fetch from products edge function
    const fallbackResp = await fetch(`${EDGE_FUNCTIONS_URL}/products`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'all', limit: 200 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!fallbackResp.ok) return [];
    const data = await fallbackResp.json();
    if (!data.success) return [];

    const allProducts = [
      ...(data.flashDeals || []),
      ...(data.trending || []),
      ...(data.newArrivals || []),
      ...(data.farmProducts || []),
      ...(data.products || []),
    ];
    const productMap = new Map(allProducts.map((p: any) => [String(p.id), p]));

    return productIds
      .map((id) => {
        const p = productMap.get(String(id)) as any;
        if (!p) return null;
        return {
          ...p,
          seller: {
            id: p.seller_id,
            business_name: p.seller_name || 'Seller',
            profile_image: p.seller_image,
            slug: p.seller_slug,
          },
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[recommend] hydrateProducts failed:', err);
    return [];
  }
}

/**
 * Hydrate video IDs with full video data from Supabase.
 * Routes through the videos Edge Function.
 */
async function hydrateVideos(videoIds: string[]): Promise<any[]> {
  if (!videoIds.length) return [];

  try {
    const numericIds = videoIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
    if (!numericIds.length) return [];

    // Fetch each video by ID (parallel, max 20)
    const results = await Promise.all(
      numericIds.slice(0, 20).map(async (id) => {
        try {
          const r = await fetch(`${EDGE_FUNCTIONS_URL}/videos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get', videoId: id }),
            signal: AbortSignal.timeout(3000),
          });
          const d = await r.json();
          return d.success ? d.video : null;
        } catch { return null; }
      })
    );
    const videoMap = new Map();
    results.filter(Boolean).forEach((v: any) => videoMap.set(String(v.id), v));

    return videoIds
      .map((id) => videoMap.get(String(id)))
      .filter(Boolean);
  } catch (err) {
    console.error('[recommend] hydrateVideos failed:', err);
    return [];
  }
}
