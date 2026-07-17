import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';

/**
 * Video Serving API
 * 
 * Serves a video from the product_videos table as a video/mp4 response.
 * This is used as the src for <video> tags on the product page.
 * 
 * GET /api/video?id=<uuid>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  if (!SUPABASE_TOKEN) {
    return NextResponse.json({ error: 'SUPABASE_TOKEN not set' }, { status: 500 });
  }

  try {
    const resp = await fetch('https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT video_data, content_type FROM product_videos WHERE id = '${videoId}'::uuid LIMIT 1;`,
      }),
    });

    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const videoData = data[0].video_data;
      const contentType = data[0].content_type || 'video/mp4';
      
      // Convert base64 to buffer
      const buffer = Buffer.from(videoData, 'base64');
      
      // Return as video response with proper headers
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000',
          'Accept-Ranges': 'bytes',
        },
      });
    }

    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
