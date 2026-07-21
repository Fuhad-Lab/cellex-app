import { NextRequest, NextResponse } from 'next/server';
import { api, API_BASE } from '@/lib/api';
import {
  getGorseRecommendations,
  getGorseItemNeighbors,
  sendGorseFeedback,
} from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';
const PROJECT = 'tcwdbokruvlizkxcpkzj';

/**
 * Recommendation API — Dynamic AI-driven feeds (replaces hard-coded feeds)
 * 
 * POST /api/recommend
 * Body: { 
 *   op: 'home' | 'category' | 'shorts' | 'neighbors' | 'feedback',
 *   userId?: string,        // for home/category/shorts
 *   category?: string,      // for category
 *   itemId?: string,        // for neighbors
 *   limit?: number,
 *   feedback?: { itemId, type, score? }  // for feedback
 * }
 * 
 * Flow:
 * 1. Authenticate user via session cookie
 * 2. Query Gorse for personalized item IDs
 * 3. Hydrate with real product data from Supabase (parallel)
 * 4. Return hydrated products with relevance scores
 * 
 * Fallback: If Gorse is unavailable, fall back to existing Supabase queries.
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

  // Use provided userId or authenticated userId, or fall back to anonymous
  const effectiveUserId = body.userId || userId || 'anonymous';

  // === OPERATIONS ===
  switch (body.op) {
    case 'home': return await handleHome(effectiveUserId, body.limit || 20);
    case 'category': return await handleCategory(effectiveUserId, body.category || '', body.limit || 30);
    case 'shorts': return await handleShorts(effectiveUserId, body.limit || 15);
    case 'neighbors': return await handleNeighbors(body.itemId || '', body.limit || 10);
    case 'feedback': return await handleFeedback(effectiveUserId, body.feedback);
    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}

/**
 * Homepage Feed — aggregates trending + personalized + collaborative filtering
 * Falls back to existing Supabase products API if Gorse is unavailable.
 */
async function handleHome(userId: string, limit: number) {
  const startTime = Date.now();

  // Parallel: Gorse recommendations + existing Supabase home data (fallback)
  const [gorseIds, fallbackResp] = await Promise.all([
    getGorseRecommendations(userId, { limit }),
    fetch(`${EDGE_FUNCTIONS_URL}/products`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'home' }),
    }).then(r => r.json()).catch(() => ({ success: false })),
  ]);

  // If Gorse returned IDs, hydrate them from Supabase
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

  // Fallback: return existing Supabase data
  return NextResponse.json({
    ...fallbackResp,
    source: 'supabase-fallback',
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Category Page Feed — blends category filters with personalization
 */
async function handleCategory(userId: string, category: string, limit: number) {
  const startTime = Date.now();

  const [gorseIds, fallbackResp] = await Promise.all([
    getGorseRecommendations(userId, { category, limit }),
    fetch(`${EDGE_FUNCTIONS_URL}/products`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'category', category, sort: 'newest' }),
    }).then(r => r.json()).catch(() => ({ success: false })),
  ]);

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

  return NextResponse.json({
    ...fallbackResp,
    source: 'supabase-fallback',
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Shorts Page Feed — hyper-engaging video content, personalized
 */
async function handleShorts(userId: string, limit: number) {
  const startTime = Date.now();

  // Get video-specific recommendations from Gorse
  const gorseIds = await getGorseRecommendations(userId, { limit });

  // Hydrate with video data from Supabase
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

  // Fallback: return existing video feed
  const fallbackResp = await fetch(`${EDGE_FUNCTIONS_URL}/videos`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'feed', limit }),
  }).then(r => r.json()).catch(() => ({ success: false }));

  return NextResponse.json({
    ...fallbackResp,
    source: 'supabase-fallback',
    latencyMs: Date.now() - startTime,
  });
}

/**
 * Product Detail "Users Also Viewed" — item-to-item collaborative filtering
 */
async function handleNeighbors(itemId: string, limit: number) {
  const startTime = Date.now();

  const neighborIds = await getGorseItemNeighbors(itemId, limit);

  if (neighborIds.length > 0) {
    const hydrated = await hydrateProducts(neighborIds);
    return NextResponse.json({
      success: true,
      source: 'gorse',
      products: hydrated,
      latencyMs: Date.now() - startTime,
    });
  }

  // Fallback: return empty (no neighbors available)
  return NextResponse.json({
    success: true,
    source: 'none',
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

  // Fire and forget — don't block the response
  sendGorseFeedback(userId, feedback.itemId, feedback.type, feedback.score);

  return NextResponse.json({
    success: true,
    message: 'Feedback received',
  });
}

/**
 * Hydrate product IDs with full product data from Supabase.
 * Uses parallel queries for speed.
 */
async function hydrateProducts(productIds: string[]): Promise<any[]> {
  if (!productIds.length) return [];

  const sqlHeaders: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };

  try {
    // Query products by IDs
    const ids = productIds.map(id => `'${id}'`).join(',');
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: sqlHeaders,
      body: JSON.stringify({
        query: `SELECT id, name, price, image_url, category, seller_id, units_sold, description FROM products WHERE id IN (${ids});`,
      }),
    });

    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    // Sort by the order Gorse returned (most relevant first)
    const productMap = new Map(data.map((p: any) => [String(p.id), p]));
    return productIds
      .map(id => productMap.get(id))
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
    const ids = videoIds.map(id => `'${id}'`).join(',');
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
      .map(id => videoMap.get(id))
      .filter(Boolean);
  } catch (err) {
    console.error('[recommend] hydrateVideos failed:', err);
    return [];
  }
}
