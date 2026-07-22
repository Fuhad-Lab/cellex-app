import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';

/**
 * Image Serving API
 *
 * Serves a product image from the product_images table as an image/* response.
 * Used as the src for <img> tags on product cards, feed posts, etc.
 *
 * GET /api/image?id=<uuid>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get('id');

  if (!imageId) {
    return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
  }

  if (!SUPABASE_TOKEN) {
    return NextResponse.json({ error: 'SUPABASE_TOKEN not set' }, { status: 500 });
  }

  // Basic UUID format check to prevent SQL injection via the URL
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(imageId)) {
    return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
  }

  try {
    const resp = await fetch('https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT image_data, content_type FROM product_images WHERE id = '${imageId}'::uuid LIMIT 1;`,
      }),
    });

    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const imageData = data[0].image_data;
      const contentType = data[0].content_type || 'image/jpeg';

      const buffer = Buffer.from(imageData, 'base64');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'bytes',
        },
      });
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
