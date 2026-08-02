import { NextRequest, NextResponse } from 'next/server';
import {
  generateTextEmbedding,
  generateImageEmbedding,
} from '@/lib/ai';

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Smart Search API — NVIDIA + pgvector powered SEMANTIC search
 *
 * This is AI-powered search that UNDERSTANDS intent, misspellings, and
 * descriptions — NOT pattern matching. If a user searches "wireless earbuds
 * for running" and a product is named "Bluetooth Sport Headphones", the
 * semantic embedding will still match them because the MEANING is similar.
 *
 * POST /api/smart-search
 * Body: {
 *   query: string,           // text search query (can be a description, misspelled, etc.)
 *   imageUrl?: string,       // optional image URL for visual search
 *   limit?: number,          // max results (default 20)
 * }
 *
 * Flow:
 * 1. Accept text query or image URL
 * 2. Generate embedding via NVIDIA nv-embedqa-e5-v5 (1024-dim)
 * 3. Query pgvector via the social Edge Function (op=pgvector_search) for
 *    similar product IDs — computes cosine similarity in Deno
 * 4. Hydrate with full product data via the social Edge Function (op=products_by_ids)
 * 5. Return ranked results with similarity scores
 *
 * Fallback: If NVIDIA/pgvector unavailable, fall back to Supabase text search.
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { query, imageUrl, limit = 20 } = body;

  if (!query && !imageUrl) {
    return NextResponse.json({ success: false, error: 'Query or imageUrl required' }, { status: 400 });
  }

  const startTime = Date.now();

  // === Step 1: Generate embedding via NVIDIA ===
  let embedding: number[] = [];
  let aiDescription = '';

  if (imageUrl) {
    const result = await generateImageEmbedding(imageUrl, query);
    embedding = result.embedding;
    aiDescription = result.description;
  } else if (query) {
    embedding = await generateTextEmbedding(query);
  }

  // === Step 2: Query pgvector via the social Edge Function ===
  let semanticResults: Array<{ id: string; score: number }> = [];

  if (embedding.length > 0) {
    try {
      const searchResp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'pgvector_search', embedding, limit }),
        signal: AbortSignal.timeout(5000),
      });
      if (searchResp.ok) {
        const data = await searchResp.json();
        if (data.success && Array.isArray(data.results)) {
          semanticResults = data.results;
        }
      }
    } catch (err) {
      console.error('[smart-search] pgvector_search error:', err);
    }
  }

  // === Step 3: Hydrate with full product data via the social Edge Function ===
  if (semanticResults.length > 0) {
    const productIds = semanticResults.map(r => r.id);
    try {
      const hydrateResp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'products_by_ids', ids: productIds.map(id => Number(id)) }),
        signal: AbortSignal.timeout(5000),
      });
      if (hydrateResp.ok) {
        const hydrateData = await hydrateResp.json();
        if (hydrateData.success && Array.isArray(hydrateData.products)) {
          // Attach similarity scores and sort by score
          const scoreMap = new Map(semanticResults.map(r => [r.id, r.score]));
          const rankedProducts = hydrateData.products
            .map((p: any) => ({
              ...p,
              _relevanceScore: scoreMap.get(String(p.id)) || 0,
              seller: {
                id: p.seller_id,
                business_name: p.seller_name || 'Seller',
                profile_image: p.seller_image,
                slug: p.seller_slug,
              },
            }))
            .sort((a: any, b: any) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

          return NextResponse.json({
            success: true,
            source: 'nvidia-pgvector',
            query: query || aiDescription,
            products: rankedProducts,
            latencyMs: Date.now() - startTime,
            aiDescription: aiDescription || undefined,
          });
        }
      }
    } catch (err) {
      console.error('[smart-search] hydrate error:', err);
    }
  }

  // === Fallback: Supabase text search (pattern matching) ===
  // Only used if NVIDIA or pgvector is unavailable.
  const fallbackResp = await fetch(`${EDGE_FUNCTIONS_URL}/products`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'search', query: query || '' }),
  }).then(r => r.json()).catch(() => ({ success: false }));

  return NextResponse.json({
    ...fallbackResp,
    source: 'supabase-fallback',
    latencyMs: Date.now() - startTime,
  });
}
