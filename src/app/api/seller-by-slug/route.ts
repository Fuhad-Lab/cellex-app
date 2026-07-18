import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const PROJECT = 'tcwdbokruvlizkxcpkzj';

/**
 * Public Seller Lookup by Slug API
 *
 * Returns seller info + products for a given slug.
 * This is PUBLIC (no auth required) so anyone can visit a storefront URL
 * like cellex.app/fuhad-shirts without logging in.
 *
 * POST /api/seller-by-slug
 * Body: { slug: "fuhad-shirts" }
 *
 * Returns:
 *   { success: true, seller: {...}, products: [...] }
 *   { success: false, error: "Seller not found" }
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_TOKEN) {
    return NextResponse.json({ success: false, error: 'SUPABASE_TOKEN not set' }, { status: 500 });
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

  // Basic slug format validation: only lowercase alphanumeric + dashes
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ success: false, error: 'Invalid slug format' }, { status: 400 });
  }

  const sqlHeaders: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };

  try {
    // Fetch seller by slug
    const sellerResp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT}/database/query`,
      {
        method: 'POST',
        headers: sqlHeaders,
        body: JSON.stringify({
          query: `SELECT * FROM sellers WHERE slug = '${slug.replace(/'/g, "''")}' LIMIT 1;`,
        }),
      }
    );

    const sellerData = await sellerResp.json();
    if (!Array.isArray(sellerData) || sellerData.length === 0) {
      return NextResponse.json({ success: false, error: 'Seller not found' }, { status: 404 });
    }

    const seller = sellerData[0];

    // Fetch the seller's products
    const productsResp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT}/database/query`,
      {
        method: 'POST',
        headers: sqlHeaders,
        body: JSON.stringify({
          query: `SELECT * FROM products WHERE seller_id = '${seller.id}' ORDER BY created_at DESC LIMIT 100;`,
        }),
      }
    );

    const productsData = await productsResp.json();
    const products = Array.isArray(productsData) ? productsData : [];

    return NextResponse.json({
      success: true,
      seller,
      products,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
