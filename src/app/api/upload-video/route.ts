import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Upload Video API
 * 
 * Receives a base64-encoded video from the seller's device and stores it
 * in the product_videos table. Returns a video URL that can be used in
 * <video src="..."> tags.
 * 
 * POST body:
 *   - productId: number
 *   - videoData: base64 data URL (data:video/mp4;base64,...)
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

  const { productId, videoData } = body;
  if (!productId || !videoData) {
    return NextResponse.json({ success: false, error: 'productId and videoData required' }, { status: 400 });
  }

  // Check video size (base64 is ~1.33x the original file size)
  // Max 10MB original = ~13MB base64
  if (videoData.length > 13 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Video too large. Max 10MB.' }, { status: 400 });
  }

  // Get user
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

    // Extract the base64 data (remove the data:video/mp4;base64, prefix)
    const base64Data = videoData.includes(',') ? videoData.split(',')[1] : videoData;
    const contentType = videoData.match(/data:(video\/[^;]+)/)?.[1] || 'video/mp4';

    // Store in product_videos table via SQL API
    const sqlHeaders: Record<string, string> = {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const resp = await fetch('https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query', {
      method: 'POST',
      headers: sqlHeaders,
      body: JSON.stringify({
        query: `INSERT INTO product_videos (product_id, seller_id, video_data, content_type) VALUES (${productId}, '${userId}'::uuid, '${base64Data}', '${contentType}') RETURNING id;`,
      }),
    });

    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const videoId = data[0].id;
      // Return a URL that serves the video via our /api/video route
      const videoUrl = `/api/video?id=${videoId}`;
      return NextResponse.json({ success: true, videoUrl });
    }

    return NextResponse.json({ success: false, error: 'Failed to upload video' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
