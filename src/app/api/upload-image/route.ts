import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Upload Product Image API
 *
 * Receives a base64-encoded image (data URL) from the seller's device and stores
 * it in a dedicated product_images table. Returns an image URL that can be used
 * as the src of <img> tags.
 *
 * POST body:
 *   - productId?: number  (optional — when editing existing product)
 *   - imageData: base64 data URL (data:image/jpeg;base64,...  OR  data:image/png;base64,...)
 *
 * Response:
 *   - { success: true, imageUrl: "/api/image?id=<uuid>" }
 *   - { success: false, error: string }
 *
 * Notes:
 *   - Max 5MB per image (base64 will be ~6.7MB).
 *   - When productId is omitted (creating a NEW product), we still store the image
 *     and return a URL — the seller-products edge function will link the URL to
 *     the product via image_url column on create.
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { productId, imageData } = body;
  if (!imageData || typeof imageData !== 'string') {
    return NextResponse.json({ success: false, error: 'imageData required' }, { status: 400 });
  }

  // Enforce 5MB ceiling on original file (base64 ~1.33x)
  if (imageData.length > 7 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Image too large. Max 5MB.' }, { status: 400 });
  }

  try {
    const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'session' }),
    });
    const authData = await authResp.json();
    if (!authData.success || !authData.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const userId = authData.user.id;

    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const contentType = imageData.match(/data:(image\/[^;]+)/)?.[1] || 'image/jpeg';

    const sqlHeaders: Record<string, string> = {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const productIdSql = productId ? `${productId}` : 'NULL';
    const resp = await fetch('https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query', {
      method: 'POST',
      headers: sqlHeaders,
      body: JSON.stringify({
        query: `INSERT INTO product_images (product_id, seller_id, image_data, content_type) VALUES (${productIdSql}, '${userId}'::uuid, '${base64Data}', '${contentType}') RETURNING id;`,
      }),
    });

    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const imageId = data[0].id;
      const imageUrl = `/api/image?id=${imageId}`;
      return NextResponse.json({ success: true, imageUrl });
    }

    return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
