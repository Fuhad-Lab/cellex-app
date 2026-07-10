/// <reference lib="deno.ns" />
// EeshaMart Products Edge Function
// ----------------------------------
// All product queries happen here. The frontend's product-loading code
// becomes thin fetch() calls to this edge function.
//
// Security benefits:
//   - Supabase service role key stays server-side
//   - Query logic (joins, filters) is not visible in page source
//   - Frontend never touches the products table directly
//
// API:
//   POST /functions/v1/products
//   Body: { "op": "home" | "search" | "category" | "by_id" | "all", ... }
//
//   op=home      → returns { flashDeals, trending, farmProducts, newArrivals }
//   op=search    → { "query": "phones", "maxPrice"?: N } returns matching products
//   op=category  → { "category": "Electronics", "sort"?: "newest|price_low|price_high" } returns products
//   op=by_id     → { "id": "..." } returns single product
//   op=all       → returns all products (with optional limit)

import { corsHeaders, jsonResponse, errorResponse, supabaseSelect } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const restHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await req.json();
    const { op } = body;

    switch (op) {
      case 'home':
        return await handleHome();
      case 'search':
        return await handleSearch(body);
      case 'category':
        return await handleCategory(body);
      case 'by_id':
        return await handleById(body);
      case 'all':
        return await handleAll(body);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Products edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---- Home page products (single round-trip for index.html) ----

async function handleHome(): Promise<Response> {
  // Run all 4 queries in parallel for speed
  const [flashDeals, trending, farmProducts, newArrivals] = await Promise.all([
    // Flash deals: products with discount > 30%
    fetchFromSupabase(
      'products?select=*&discount_percentage=gt.30&limit=5'
    ),
    // Trending: newest products
    fetchFromSupabase(
      'products?select=*&order=created_at.desc&limit=10'
    ),
    // Farm products: from farmers (join with sellers)
    fetchFromSupabase(
      'products?select=*,sellers!inner(seller_type)&sellers.seller_type=eq.FARMER&limit=5'
    ),
    // New arrivals: also newest, but limited to 5
    fetchFromSupabase(
      'products?select=*&order=created_at.desc&limit=5'
    ),
  ]);

  return jsonResponse({
    success: true,
    flashDeals: flashDeals || [],
    trending: trending || [],
    farmProducts: farmProducts || [],
    newArrivals: newArrivals || [],
  });
}

// ---- Search products ----

async function handleSearch(body: Record<string, unknown>): Promise<Response> {
  const query = (body.query as string) || '';
  const maxPrice = body.maxPrice as number | undefined;
  const limit = (body.limit as number) || 20;

  if (!query.trim()) {
    return errorResponse('Missing "query"', 400);
  }

  const terms = query.toLowerCase().replace(/-/g, ' ').split(' ').filter(t => t.length > 1);

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'show', 'me', 'find',
    'search', 'looking', 'want', 'please', 'you', 'get', 'i', 'this',
    'that', 'it', 'and', 'or', 'but', 'not', 'no', 'yes', 'what', 'how',
    'why', 'when', 'where', 'which', 'who', 'some', 'any', 'all', 'each',
    'more', 'also', 'very', 'much', 'many', 'too', 'just', 'only'
  ]);

  const searchTerms = terms.filter(t => !stopWords.has(t));
  if (searchTerms.length === 0) {
    searchTerms.push(...terms.slice(-3));
  }

  // Build OR filter
  const filters = searchTerms.map(t => `name.ilike.%${t}%`).concat(
    searchTerms.map(t => `category.ilike.%${t}%`),
    searchTerms.map(t => `description.ilike.%${t}%`)
  );

  let url = `${SUPABASE_URL}/rest/v1/products?select=*&or=(${encodeURIComponent(filters.join(','))})&order=created_at.desc&limit=${limit}`;

  if (maxPrice) {
    url += `&price=lte.${maxPrice}`;
  }

  const products = await fetchFromUrl(url);

  return jsonResponse({ success: true, products: products || [] });
}

// ---- Products by category ----

async function handleCategory(body: Record<string, unknown>): Promise<Response> {
  const category = (body.category as string) || '';
  const sort = (body.sort as string) || 'newest';
  const limit = (body.limit as number) || 50;
  const page = (body.page as number) || 1;
  const offset = (page - 1) * limit;

  if (!category) {
    return errorResponse('Missing "category"', 400);
  }

  // Build sort order
  let orderParam = 'created_at.desc';
  if (sort === 'price_low') orderParam = 'price.asc';
  else if (sort === 'price_high') orderParam = 'price.desc';
  else if (sort === 'name') orderParam = 'name.asc';

  const url = `${SUPABASE_URL}/rest/v1/products?select=*,sellers(name,seller_type)&category=ilike.${encodeURIComponent(category)}&order=${orderParam}&limit=${limit}&offset=${offset}`;

  const products = await fetchFromUrl(url);

  return jsonResponse({ success: true, products: products || [] });
}

// ---- Single product by ID ----

async function handleById(body: Record<string, unknown>): Promise<Response> {
  const id = body.id;

  if (!id) {
    return errorResponse('Missing "id"', 400);
  }

  const url = `${SUPABASE_URL}/rest/v1/products?select=*,sellers(business_name,seller_type,phone,email)&id=eq.${id}&limit=1`;

  const products = await fetchFromUrl(url);

  if (!products || products.length === 0) {
    return errorResponse('Product not found', 404);
  }

  return jsonResponse({ success: true, product: products[0] });
}

// ---- All products (with optional limit) ----

async function handleAll(body: Record<string, unknown>): Promise<Response> {
  const limit = (body.limit as number) || 100;

  const products = await fetchFromSupabase(
    `products?select=id,name,price,category,image_url&order=created_at.desc&limit=${limit}`
  );

  return jsonResponse({ success: true, products: products || [] });
}

// ---- Helper: fetch from Supabase REST ----

async function fetchFromSupabase(path: string): Promise<Record<string, unknown>[] | null> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  return await fetchFromUrl(url);
}

async function fetchFromUrl(url: string): Promise<Record<string, unknown>[] | null> {
  try {
    const resp = await fetch(url, { headers: restHeaders });

    if (!resp.ok) {
      console.error(`Supabase REST error: ${resp.status} ${resp.statusText}`);
      console.error('URL:', url.substring(0, 200));
      const text = await resp.text();
      console.error('Body:', text.substring(0, 500));
      return null;
    }

    return await resp.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}
