import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Upload Product Image API
 *
 * Routes through the social Edge Function (op=upload_image) — NO direct
 * database access or SUPABASE_TOKEN in the frontend.
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 500 });
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

  if (imageData.length > 7 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Image too large. Max 5MB.' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ op: 'upload_image', productId, imageData }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
