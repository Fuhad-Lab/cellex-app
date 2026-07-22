/**
 * AI Infrastructure Configuration
 * 
 * Central config for NVIDIA NIM, Chroma Vector DB, and Gorse Recommender.
 * All keys are read from environment variables (set in Render dashboard).
 */

// === NVIDIA NIM API ===
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// NVIDIA model endpoints (optimized for speed)
export const NVIDIA_MODELS = {
  // Text embeddings for semantic search (1024-dim).
  // NOTE: 'nvidia/embed-qa-4' is not enabled on the current NVIDIA account,
  // so we use 'nvidia/nv-embedqa-e5-v5' which is enabled and produces the same
  // 1024-dim vectors — drop-in replacement.
  textEmbedding: 'nvidia/nv-embedqa-e5-v5',
  // Multimodal vision-language model for image-to-product search
  multimodal: 'nvidia/neva-22b',
  // LLM for generating search context/summaries
  llm: 'meta/llama-3.1-70b-instruct',
} as const;

// Cache the collection id from Chroma (v1 API addresses collections by id, not name).
let cachedChromaCollectionId: string | null = null;

// === Chroma Vector DB ===
export const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
export const CHROMA_COLLECTION = 'cellex_products';

// === Gorse Recommender System ===
export const GORSE_URL = process.env.GORSE_URL || 'http://localhost:8088';
export const GORSE_API_KEY = process.env.GORSE_API_KEY || '';

// === Performance Targets ===
export const PERF = {
  targetResponseMs: 3000,    // 3 second overall target
  nvidiaTimeoutMs: 2000,     // NVIDIA API timeout
  chromaTimeoutMs: 1000,     // Chroma query timeout
  gorseTimeoutMs: 1000,      // Gorse recommendation timeout
  supabaseTimeoutMs: 3000,   // Supabase hydration timeout (was 1000 — too short for SQL API CTEs)
} as const;

/**
 * Generate a text embedding using NVIDIA NIM (embed-qa-4).
 * Returns a 1024-dimensional float array.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) {
    console.warn('[AI] NVIDIA_API_KEY not set, skipping embedding');
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.nvidiaTimeoutMs);

  try {
    const resp = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODELS.textEmbedding,
        input: text,
        input_type: 'query',
        encoding_format: 'float',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('[AI] NVIDIA embedding error:', resp.status, await resp.text());
      return [];
    }

    const data = await resp.json();
    return data.data?.[0]?.embedding || [];
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] NVIDIA embedding failed:', err);
    return [];
  }
}

/**
 * Generate a multimodal embedding using NVIDIA NeVA-22B.
 * Accepts an image URL and optional text prompt, returns a description/embedding.
 */
export async function generateImageEmbedding(imageUrl: string, prompt?: string): Promise<{ description: string; embedding: number[] }> {
  if (!NVIDIA_API_KEY) {
    return { description: '', embedding: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.nvidiaTimeoutMs);

  try {
    const resp = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODELS.multimodal,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'Describe this product for e-commerce search. Include category, color, material, and key features.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('[AI] NVIDIA NeVA error:', resp.status);
      return { description: '', embedding: [] };
    }

    const data = await resp.json();
    const description = data.choices?.[0]?.message?.content || '';

    // Generate embedding from the description
    const embedding = await generateTextEmbedding(description);

    return { description, embedding };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] NVIDIA NeVA failed:', err);
    return { description: '', embedding: [] };
  }
}

/**
 * Resolve the Chroma collection id for CHROMA_COLLECTION.
 * Chroma v1 API addresses collections by id, not name, so we list collections
 * once, find ours by name, and cache the id. If the collection doesn't exist,
 * we create it (so first-run works without manual setup).
 */
async function ensureChromaCollectionId(): Promise<string | null> {
  if (cachedChromaCollectionId) return cachedChromaCollectionId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.chromaTimeoutMs);

  try {
    const listResp = await fetch(`${CHROMA_URL}/api/v1/collections`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!listResp.ok) {
      console.error('[AI] Chroma list collections error:', listResp.status);
      return null;
    }

    const collections = await listResp.json();
    const found = (collections as Array<{ id: string; name: string }>).find(
      (c) => c.name === CHROMA_COLLECTION,
    );

    if (found) {
      cachedChromaCollectionId = found.id;
      return found.id;
    }

    // Not found — create it
    const createResp = await fetch(`${CHROMA_URL}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: CHROMA_COLLECTION }),
    });
    if (!createResp.ok) {
      console.error('[AI] Chroma create collection error:', createResp.status);
      return null;
    }
    const created = await createResp.json();
    cachedChromaCollectionId = created.id;
    return created.id;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] Chroma collection resolution failed:', err);
    return null;
  }
}

/**
 * Query Chroma Vector DB for similar product IDs.
 * Uses Chroma v1 API (collections addressed by id).
 * Returns array of { id, score } pairs.
 */
export async function queryChroma(embedding: number[], limit: number = 20): Promise<Array<{ id: string; score: number }>> {
  if (!embedding.length) return [];

  const collectionId = await ensureChromaCollectionId();
  if (!collectionId) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.chromaTimeoutMs);

  try {
    const resp = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [embedding],
        n_results: limit,
        include: ['distances', 'documents', 'metadatas'],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('[AI] Chroma query error:', resp.status);
      return [];
    }

    const data = await resp.json();
    const ids = data.ids?.[0] || [];
    const distances = data.distances?.[0] || [];

    return ids.map((id: string, i: number) => ({
      id,
      score: 1 - (distances[i] || 0), // Convert distance to similarity score
    }));
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] Chroma query failed:', err);
    return [];
  }
}

/**
 * Fetch personalized recommendations from Gorse.
 * Returns array of product IDs ranked by relevance.
 */
export async function getGorseRecommendations(
  userId: string,
  options: { category?: string; limit?: number; page?: number } = {}
): Promise<string[]> {
  const { category, limit = 20, page = 0 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.gorseTimeoutMs);

  try {
    // If category is specified, use category-aware recommendation
    const endpoint = category
      ? `${GORSE_URL}/api/recommend/${userId}?n=${limit}&offset=${page * limit}&categories=${encodeURIComponent(category)}`
      : `${GORSE_URL}/api/recommend/${userId}?n=${limit}&offset=${page * limit}`;

    const resp = await fetch(endpoint, {
      headers: GORSE_API_KEY ? { 'Api-Key': GORSE_API_KEY } : {},
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('[AI] Gorse recommend error:', resp.status);
      return [];
    }

    const data = await resp.json();
    return data.Items || data.items || [];
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] Gorse recommend failed:', err);
    return [];
  }
}

/**
 * Get item-to-item neighbors (for "Users also viewed" section).
 */
export async function getGorseItemNeighbors(itemId: string, limit: number = 10): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.gorseTimeoutMs);

  try {
    const resp = await fetch(`${GORSE_URL}/api/item/${itemId}/neighbors?n=${limit}`, {
      headers: GORSE_API_KEY ? { 'Api-Key': GORSE_API_KEY } : {},
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) return [];

    const data = await resp.json();
    return data.Items || data.items || [];
  } catch (err) {
    clearTimeout(timeout);
    return [];
  }
}

/**
 * Send feedback to Gorse (likes, clicks, views, purchases).
 * Non-blocking — fire and forget.
 */
export async function sendGorseFeedback(
  userId: string,
  itemId: string,
  feedbackType: 'like' | 'click' | 'view' | 'purchase' | 'skip' | 'replay',
  score?: number
): Promise<void> {
  if (!GORSE_URL) return;

  const scoreMap: Record<string, number> = {
    like: 1,
    click: 0.5,
    view: 0.3,
    purchase: 2,
    skip: -0.1,
    replay: 0.8,
  };

  const payload = {
    Feedback: [{
      UserId: userId,
      ItemId: itemId,
      FeedbackType: feedbackType,
      Timestamp: new Date().toISOString(),
      Score: score ?? scoreMap[feedbackType] ?? 0.5,
    }],
  };

  // Fire and forget — don't await, don't block
  fetch(`${GORSE_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GORSE_API_KEY ? { 'Api-Key': GORSE_API_KEY } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Silently ignore errors
}

// ============================================================================
// Chroma embed/sync utilities (incremental — used by product create/update/delete)
// ============================================================================

/**
 * Generate a "passage" embedding for a product (used when STORING in Chroma).
 * The query-time embedding (input_type='query') is generated by generateTextEmbedding().
 */
export async function generateProductPassageEmbedding(text: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODELS.textEmbedding,
        input: text,
        input_type: 'passage',
        encoding_format: 'float',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('[AI] NVIDIA passage embedding error:', resp.status, await resp.text());
      return [];
    }

    const data = await resp.json();
    return data.data?.[0]?.embedding || [];
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] NVIDIA passage embedding failed:', err);
    return [];
  }
}

/**
 * Build the searchable text for a product (name + category + description).
 * Used both at seed time and at incremental-sync time so the text is consistent.
 */
export function buildProductSearchText(p: {
  name?: string | null;
  category?: string | null;
  description?: string | null;
}): string {
  return [p.name, p.category, p.description]
    .filter((s) => s && String(s).trim())
    .map((s) => String(s).trim())
    .join(' ');
}

/**
 * Add (or update) a single product's embedding in Chroma.
 * Called when a seller creates or updates a product.
 * Uses Chroma v1 API: POST /api/v1/collections/{id}/add (upsert semantics).
 *
 * Non-throwing — logs errors and returns boolean.
 */
export async function upsertProductToChroma(
  productId: string | number,
  product: { name?: string | null; category?: string | null; description?: string | null; price?: number | string | null; image_url?: string | null },
): Promise<boolean> {
  if (!NVIDIA_API_KEY) {
    console.warn('[AI] upsertProductToChroma: NVIDIA_API_KEY not set, skipping');
    return false;
  }

  const text = buildProductSearchText(product);
  if (!text) {
    console.warn(`[AI] upsertProductToChroma: empty text for product ${productId}, skipping`);
    return false;
  }

  const embedding = await generateProductPassageEmbedding(text);
  if (!embedding.length) {
    console.error(`[AI] upsertProductToChroma: failed to embed product ${productId}`);
    return false;
  }

  const collectionId = await ensureChromaCollectionId();
  if (!collectionId) {
    console.error('[AI] upsertProductToChroma: no Chroma collection id');
    return false;
  }

  const metadata = {
    product_id: String(productId),
    name: product.name || '',
    price: String(product.price ?? 0),
    category: product.category || '',
    image_url: product.image_url || '',
    text,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.chromaTimeoutMs);

  try {
    const resp = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [String(productId)],
        embeddings: [embedding],
        metadatas: [metadata],
        documents: [text],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.error(`[AI] Chroma upsert error for product ${productId}:`, resp.status);
      return false;
    }
    return true;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[AI] Chroma upsert failed for product ${productId}:`, err);
    return false;
  }
}

/**
 * Delete a single product's embedding from Chroma.
 * Called when a seller deletes a product.
 */
export async function deleteProductFromChroma(productId: string | number): Promise<boolean> {
  const collectionId = await ensureChromaCollectionId();
  if (!collectionId) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.chromaTimeoutMs);

  try {
    const resp = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [String(productId)] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.error(`[AI] Chroma delete error for product ${productId}:`, resp.status);
      return false;
    }
    return true;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[AI] Chroma delete failed for product ${productId}:`, err);
    return false;
  }
}

// ============================================================================
// Real in-process trending (cold-start fallback for Gorse).
// Computes a real engagement score from Supabase tables — no fake math.
// Used by /api/recommend when Gorse is not configured OR returns nothing
// (cold-start: new user, new item, or Gorse temporarily down).
// NOTE: Gorse does recommendations. Chroma does semantic search. This function
// does NEITHER — it just ranks by real engagement metrics as a fallback.
// ============================================================================

/**
 * Fetch all product IDs+engagement metrics from Supabase via the management SQL API.
 * Returns rows sorted by a real engagement score (descending).
 *
 * Engagement score (computed from REAL tables, no fake math):
 *   units_sold * 4                    — sales are the strongest signal
 *   + view_count * 0.5                — from product_view_log
 *   + wishlist_count * 3              — from buyers_wishlist (strong intent)
 *   + review_count * 2                — from buyers_reviews (engagement)
 *   + recency_bonus (50 if <7d, 20 if <30d)
 */
export async function fetchRealProductRankingFromSupabase(limit: number): Promise<Array<{
  id: string;
  score: number;
  units_sold: number;
  views_count: number;
  created_at: string;
}>> {
  const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
  const PROJECT = process.env.SUPABASE_PROJECT || 'tcwdbokruvlizkxcpkzj';
  if (!SUPABASE_TOKEN) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.supabaseTimeoutMs);

  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-recommend',
      },
      body: JSON.stringify({
        query: `
          WITH view_counts AS (
            SELECT product_id, COUNT(*) AS view_count
            FROM product_view_log
            GROUP BY product_id
          ),
          wishlist_counts AS (
            SELECT product_id, COUNT(*) AS wishlist_count
            FROM buyers_wishlist
            GROUP BY product_id
          ),
          review_counts AS (
            SELECT product_id, COUNT(*) AS review_count
            FROM buyers_reviews
            GROUP BY product_id
          )
          SELECT p.id,
                 COALESCE(p.units_sold, 0) AS units_sold,
                 COALESCE(vc.view_count, 0) AS views_count,
                 COALESCE(wc.wishlist_count, 0) AS wishlist_count,
                 COALESCE(rc.review_count, 0) AS review_count,
                 p.created_at,
                 (COALESCE(p.units_sold, 0) * 4
                  + COALESCE(vc.view_count, 0) * 0.5
                  + COALESCE(wc.wishlist_count, 0) * 3
                  + COALESCE(rc.review_count, 0) * 2
                  + CASE WHEN p.created_at > NOW() - INTERVAL '7 days'  THEN 50
                         WHEN p.created_at > NOW() - INTERVAL '30 days' THEN 20
                         ELSE 0 END) AS score
          FROM products p
          LEFT JOIN view_counts vc     ON vc.product_id = p.id
          LEFT JOIN wishlist_counts wc ON wc.product_id = p.id
          LEFT JOIN review_counts rc   ON rc.product_id = p.id
          ORDER BY score DESC
          LIMIT ${Math.min(limit * 4, 200)};
        `.trim(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[AI] Supabase ranking query error:', resp.status, errText.slice(0, 200));
      return [];
    }
    const data = await resp.json();
    if (!Array.isArray(data)) {
      console.error('[AI] Supabase ranking query: non-array response:', typeof data);
      return [];
    }
    return data.map((r: any) => ({
      id: String(r.id),
      score: Number(r.score) || 0,
      units_sold: Number(r.units_sold) || 0,
      views_count: Number(r.views_count) || 0,
      created_at: r.created_at,
    }));
  } catch (err) {
    clearTimeout(timeout);
    console.error('[AI] Supabase ranking query failed:', err);
    return [];
  }
}
