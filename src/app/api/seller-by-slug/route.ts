import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';

/**
 * Public Seller Lookup by Slug API
 *
 * Returns seller info + products for a given slug.
 * This is PUBLIC (no auth required) so anyone can visit a storefront URL
 * like cellex.app/fuhad without logging in.
 *
 * Routes through the social Edge Function (which uses SUPABASE_SERVICE_ROLE_KEY)
 * instead of the expired SUPABASE_TOKEN management API.
 *
 * POST /api/seller-by-slug
 * Body: { slug: "fuhad" }
 *
 * Returns:
 *   { success: true, seller: {...}, products: [...] }
 *   { success: false, error: "Seller not found" }
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const slug = (body.slug || '').trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug required' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'seller_by_slug', slug }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
