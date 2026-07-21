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
  // Text embeddings for semantic search (ultra-fast, 1024-dim vectors)
  textEmbedding: 'nvidia/embed-qa-4',
  // Multimodal vision-language model for image-to-product search
  multimodal: 'nvidia/neva-22b',
  // LLM for generating search context/summaries
  llm: 'meta/llama-3.1-70b-instruct',
} as const;

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
  supabaseTimeoutMs: 1000,   // Supabase hydration timeout
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
 * Query Chroma Vector DB for similar product IDs.
 * Returns array of { id, score } pairs.
 */
export async function queryChroma(embedding: number[], limit: number = 20): Promise<Array<{ id: string; score: number }>> {
  if (!embedding.length) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERF.chromaTimeoutMs);

  try {
    const resp = await fetch(`${CHROMA_URL}/api/v2/collections/${CHROMA_COLLECTION}/query`, {
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
