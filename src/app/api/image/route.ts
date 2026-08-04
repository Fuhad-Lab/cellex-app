import { NextRequest, NextResponse } from 'next/server';

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';

/**
 * Image Serving API
 *
 * Serves a product image from the product_images table.
 * Routes through the social Edge Function (op=get_image) — NO direct
 * database access or SUPABASE_TOKEN in the frontend.
 *
 * GET /api/image?id=<uuid>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get('id');

  if (!imageId) {
    return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
  }

  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(imageId)) {
    return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'get_image', imageId }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const data = await resp.json();
    if (data.success && data.imageData) {
      const buffer = Buffer.from(data.imageData, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': data.contentType || 'image/jpeg',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'bytes',
        },
      });
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
