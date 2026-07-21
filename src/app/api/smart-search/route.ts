import { NextRequest, NextResponse } from 'next/server';
import {
  generateTextEmbedding,
  generateImageEmbedding,
  queryChroma,
  NVIDIA_API_KEY,
} from '@/lib/ai';
import { api, API_BASE } from '@/lib/api';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Smart Search API — NVIDIA + Chroma powered semantic search
 * 
 * POST /api/smart-search
 * Body: {
 *   query: string,           // text search query
 *   imageUrl?: string,       // optional image URL for visual search
 *   limit?: number,          // max results (default 20)
 * }
 * 
 * Flow:
 * 1. Accept text query or image URL
 * 2. Generate embedding via NVIDIA (embed-qa-4 for text, neva-22b for image)
 * 3. Query Chroma Vector DB for similar product IDs
 * 4. Hydrate with full product data from Supabase
 * 5. Return ranked results with similarity scores
 * 
 * Fallback: If NVIDIA/Chroma unavailable, fall back to Supabase text search.
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

  // === Step 1: Generate embedding ===
  let embedding: number[] = [];
  let aiDescription = '';

  if (imageUrl) {
    // Image search: use NVIDIA NeVA-22B to describe the image, then embed
    const result = await generateImageEmbedding(imageUrl, query);
    embedding = result.embedding;
    aiDescription = result.description;
  } else if (query) {
    // Text search: use NVIDIA embed-qa-4
    embedding = await generateTextEmbedding(query);
  }

  // === Step 2: Query Chroma Vector DB ===
  let chromaResults: Array<{ id: string; score: number }> = [];

  if (embedding.length > 0) {
    chromaResults = await queryChroma(embedding, limit);
  }

  // === Step 3: Hydrate with Supabase data ===
  if (chromaResults.length > 0) {
    const productIds = chromaResults.map(r => r.id);
    const products = await hydrateProducts(productIds);

    // Attach similarity scores
    const scoreMap = new Map(chromaResults.map(r => [r.id, r.score]));
    const rankedProducts = products.map(p => ({
      ...p,
      _relevanceScore: scoreMap.get(String(p.id)) || 0,
    }));

    return NextResponse.json({
      success: true,
      source: 'nvidia-chroma',
      query: query || aiDescription,
      products: rankedProducts,
      latencyMs: Date.now() - startTime,
      aiDescription: aiDescription || undefined,
    });
  }

  // === Fallback: Supabase text search ===
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

    const productMap = new Map(data.map((p: any) => [String(p.id), p]));
    return productIds
      .map(id => productMap.get(id))
      .filter(Boolean);
  } catch (err) {
    console.error('[smart-search] hydrateProducts failed:', err);
    return [];
  }
}
