/**
 * AI Infrastructure — Edge Function Proxy Layer
 *
 * SECURITY: This file contains NO direct database calls, NO API keys, and NO
 * internal service URLs. ALL operations are routed through Supabase Edge
 * Functions (the secure middle layer).
 *
 * The frontend (including Next.js API routes) NEVER talks directly to:
 * - Supabase Management API (api.supabase.com)
 * - Supabase database (direct SQL)
 * - NVIDIA API (integrate.api.nvidia.com)
 * - Gorse recommender (direct)
 * - Any internal service
 *
 * Everything goes through Edge Functions which handle auth, validation,
 * and routing to the correct backend service.
 */

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';

// NOTE: The Supabase project URL is public (it's the Edge Function endpoint).
// The anon key is public (RLS denies all — only Edge Functions with the
// service role key can access data). NO secrets here.

// === Performance Targets ===
export const PERF = {
  targetResponseMs: 3000,
  nvidiaTimeoutMs: 2000,
  gorseTimeoutMs: 5000,
  supabaseTimeoutMs: 3000,
} as const;

// ============================================================================
// NVIDIA Embeddings — routed through Edge Functions
// ============================================================================

/**
 * Generate a text embedding via NVIDIA nv-embedqa-e5-v5.
 * Routes through the social Edge Function (op=generate_embedding) which
 * has the NVIDIA_API_KEY in its environment.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!text) return [];
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'generate_embedding', text }),
      signal: AbortSignal.timeout(PERF.nvidiaTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.embedding || [];
  } catch {
    return [];
  }
}

/**
 * Generate a passage embedding (for storing products).
 * Same as above but with input_type='passage'.
 */
export async function generateProductPassageEmbedding(text: string): Promise<number[]> {
  if (!text) return [];
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'generate_embedding', text, inputType: 'passage' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.embedding || [];
  } catch {
    return [];
  }
}

// ============================================================================
// Gorse Recommender — routed through Edge Functions
// ============================================================================

/**
 * Fetch personalized recommendations from Gorse.
 * Routes through the social Edge Function (op=gorse_recommend).
 */
export async function getGorseRecommendations(
  userId: string,
  options: { category?: string; limit?: number; page?: number } = {}
): Promise<string[]> {
  const { category, limit = 20, page = 0 } = options;
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'gorse_recommend', userId, category, limit, page }),
      signal: AbortSignal.timeout(PERF.gorseTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.items || data.Items || [];
  } catch {
    return [];
  }
}

/**
 * Fetch item neighbors (similar items) from Gorse.
 */
export async function getGorseItemNeighbors(itemId: string, limit: number = 10): Promise<string[]> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'gorse_neighbors', itemId, limit }),
      signal: AbortSignal.timeout(PERF.gorseTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.items || data.Items || [];
  } catch {
    return [];
  }
}

/**
 * Send feedback to Gorse (views, likes, purchases).
 * Routes through the social Edge Function (op=gorse_feedback).
 */
export async function sendGorseFeedback(
  userId: string,
  itemId: string,
  feedbackType: 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay',
  score?: number
): Promise<void> {
  if (!userId || !itemId) return;
  try {
    fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'gorse_feedback', userId, itemId, feedbackType, score }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {}
}

// ============================================================================
// pgvector Operations — routed through Edge Functions
// ============================================================================

/**
 * Query pgvector for similar products.
 * Routes through the social Edge Function (op=pgvector_search).
 */
export async function queryChroma(embedding: number[], limit: number = 20): Promise<Array<{ id: string; score: number }>> {
  if (!embedding.length) return [];
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'pgvector_search', embedding, limit }),
      signal: AbortSignal.timeout(PERF.supabaseTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

/**
 * Upsert a product embedding to pgvector.
 * Routes through the social Edge Function (op=pgvector_upsert).
 */
export async function upsertProductToChroma(productId: string | number, product: any): Promise<boolean> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'pgvector_upsert', productId, product }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a product embedding from pgvector.
 * Routes through the social Edge Function (op=pgvector_delete).
 */
export async function deleteProductFromChroma(productId: string | number): Promise<boolean> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'pgvector_delete', productId }),
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Trending (cold-start fallback) — routed through Edge Functions
// ============================================================================

/**
 * Fetch real product ranking from Supabase.
 * Routes through the social Edge Function (op=trending_products).
 */
export async function fetchRealProductRankingFromSupabase(limit: number = 20): Promise<Array<any>> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'trending_products', limit }),
      signal: AbortSignal.timeout(PERF.supabaseTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.products || [];
  } catch {
    return [];
  }
}

/**
 * Fetch real video ranking from Supabase.
 * Routes through the social Edge Function (op=trending_videos).
 */
export async function fetchRealVideoRankingFromSupabase(limit: number = 20): Promise<Array<any>> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'trending_videos', limit }),
      signal: AbortSignal.timeout(PERF.supabaseTimeoutMs),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.videos || [];
  } catch {
    return [];
  }
}

/**
 * Generate an image embedding for visual search.
 * Routes through the social Edge Function (op=generate_image_embedding).
 */
export async function generateImageEmbedding(imageUrl: string, _query?: string): Promise<{ embedding: number[]; description: string }> {
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'generate_image_embedding', imageUrl, query: _query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { embedding: [], description: '' };
    const data = await resp.json();
    return { embedding: data.embedding || [], description: data.description || '' };
  } catch {
    return { embedding: [], description: '' };
  }
}

// ============================================================================
// Deprecated exports (kept for backward compat — NO sensitive data)
// ============================================================================

// These are NO LONGER exported — they were internal config that shouldn't
// be in the frontend. All AI operations now route through Edge Functions.
// If any file imports these, it will need to be updated to use the
// Edge Function proxy functions above.
