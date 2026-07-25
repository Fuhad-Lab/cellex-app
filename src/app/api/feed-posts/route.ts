import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Feed Posts API — unified post creation for all types.
 *
 * POST /api/feed-posts
 * Body: {
 *   op: 'list' | 'create' | 'delete' | 'mine',
 *   // For create:
 *   postType: 'video' | 'photo' | 'text' | 'story',
 *   productId: number,         // REQUIRED — the product being talked about
 *   caption?: string,
 *   mediaUrl?: string,         // image/video URL (required for video/photo/story)
 *   thumbnailUrl?: string,
 *   // For delete:
 *   postId?: number,
 *   // For list:
 *   limit?: number,
 *   sellerId?: string,         // filter by seller
 * }
 *
 * All post types require a product attachment. The product shows in the feed card.
 * Stories auto-expire after 24h (story_expires_at = NOW() + 24h).
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // === AUTH ===
  let userId = '';
  let sellerId = '';
  if (sessionId) {
    try {
      const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: 'session' }),
      });
      const authData = await authResp.json();
      if (authData.success && authData.user) {
        userId = authData.user.id;
      }
    } catch {}
  }

  // Get seller_id for the authenticated user
  if (userId) {
    try {
      const sellerResp = await fetch(`${EDGE_FUNCTIONS_URL}/seller-profile`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: 'get' }),
      });
      const sellerData = await sellerResp.json();
      if (sellerData.success && sellerData.seller) {
        sellerId = sellerData.seller.id;
      }
    } catch {}
  }

  switch (body.op) {
    case 'list':    return await handleList(body.limit || 50, body.sellerId);
    case 'create':  return await handleCreate(userId, sellerId, body);
    case 'delete':  return await handleDelete(userId, sellerId, body.postId);
    case 'mine':    return await handleList(50, sellerId);
    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}

async function runSql(query: string) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'cellex-feed-posts',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[feed-posts] SQL error:', resp.status, errText.slice(0, 200));
    return null;
  }
  return await resp.json();
}

/**
 * List feed posts — joins with products + sellers to get full card data.
 * Excludes expired stories.
 */
async function handleList(limit: number, sellerId?: string) {
  const safeSellerId = sellerId ? sellerId.replace(/'/g, "''") : '';
  const sellerFilter = sellerId ? `AND fp.seller_id = '${safeSellerId}'::uuid` : '';

  const query = `
    SELECT fp.id, fp.post_type, fp.caption, fp.media_url, fp.thumbnail_url,
           fp.views_count, fp.likes_count, fp.comments_count, fp.created_at,
           fp.story_expires_at,
           p.id AS product_id, p.name AS product_name, p.price AS product_price,
           p.image_url AS product_image, p.units_sold AS product_units_sold,
           p.category AS product_category, p.group_buy_enabled,
           s.business_name AS seller_name, s.profile_image AS seller_image,
           s.slug AS seller_slug
    FROM feed_posts fp
    INNER JOIN products p ON p.id = fp.product_id
    INNER JOIN sellers s ON s.id = fp.seller_id
    WHERE fp.status = 'active'
      AND (fp.story_expires_at IS NULL OR fp.story_expires_at > NOW())
      ${sellerFilter}
    ORDER BY fp.created_at DESC
    LIMIT ${Math.min(limit, 100)};
  `.trim();

  const rows = await runSql(query);
  if (rows === null) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

  return NextResponse.json({
    success: true,
    posts: (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      postType: r.post_type,
      caption: r.caption,
      mediaUrl: r.media_url,
      thumbnailUrl: r.thumbnail_url,
      viewsCount: r.views_count,
      likesCount: r.likes_count,
      commentsCount: r.comments_count,
      createdAt: r.created_at,
      storyExpiresAt: r.story_expires_at,
      product: {
        id: r.product_id,
        name: r.product_name,
        price: r.product_price,
        image_url: r.product_image,
        units_sold: r.product_units_sold,
        category: r.product_category,
        group_buy_enabled: r.group_buy_enabled,
      },
      seller: {
        name: r.seller_name,
        image: r.seller_image,
        slug: r.seller_slug,
      },
    })),
  });
}

/**
 * Create a feed post. Requires authentication + seller account.
 * All post types require a product_id.
 */
async function handleCreate(userId: string, sellerId: string, body: any) {
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }
  if (!sellerId) {
    return NextResponse.json({ success: false, error: 'Seller account required to post' }, { status: 403 });
  }

  const { postType, productId, caption, mediaUrl, thumbnailUrl } = body;

  // Validate post type
  if (!['video', 'photo', 'text', 'story'].includes(postType)) {
    return NextResponse.json({ success: false, error: 'Invalid post type' }, { status: 400 });
  }

  // Product attachment is REQUIRED
  if (!productId) {
    return NextResponse.json({ success: false, error: 'Product attachment is required for all posts' }, { status: 400 });
  }

  // Media required for non-text posts
  if (postType !== 'text' && !mediaUrl) {
    return NextResponse.json({ success: false, error: 'Media URL required for video/photo/story posts' }, { status: 400 });
  }

  const safeSellerId = sellerId.replace(/'/g, "''");
  const safeCaption = (caption || '').replace(/'/g, "''").slice(0, 2000);
  const safeMediaUrl = (mediaUrl || '').replace(/'/g, "''").slice(0, 1000);
  const safeThumbnailUrl = (thumbnailUrl || '').replace(/'/g, "''").slice(0, 1000);
  const safeProductId = Number(productId);
  if (!Number.isFinite(safeProductId)) {
    return NextResponse.json({ success: false, error: 'Invalid productId' }, { status: 400 });
  }

  // Story expiry: 24 hours from now
  const storyExpiry = postType === 'story' ? "NOW() + INTERVAL '24 hours'" : 'NULL';

  const query = `
    INSERT INTO feed_posts (seller_id, post_type, product_id, caption, media_url, thumbnail_url, story_expires_at)
    VALUES ('${safeSellerId}'::uuid, '${postType}', ${safeProductId}::bigint, '${safeCaption}', '${safeMediaUrl}', '${safeThumbnailUrl}', ${storyExpiry})
    RETURNING id, created_at;
  `.trim();

  const rows = await runSql(query);
  if (rows === null) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) {
    return NextResponse.json({ success: false, error: 'Insert returned no row' }, { status: 500 });
  }

  // Fire Gorse feedback (new item = positive signal)
  try { sendGorseFeedback(userId, `post:${row.id}`, 'like', 1); } catch {}

  return NextResponse.json({
    success: true,
    post: {
      id: row.id,
      postType,
      productId: safeProductId,
      caption,
      mediaUrl,
      thumbnailUrl,
      createdAt: row.created_at,
    },
  });
}

/**
 * Delete a feed post. Only the seller who created it can delete.
 */
async function handleDelete(userId: string, sellerId: string, postId: number) {
  if (!userId || !sellerId) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }
  if (!postId) {
    return NextResponse.json({ success: false, error: 'postId required' }, { status: 400 });
  }

  const safeSellerId = sellerId.replace(/'/g, "''");
  const safePostId = Number(postId);
  if (!Number.isFinite(safePostId)) {
    return NextResponse.json({ success: false, error: 'Invalid postId' }, { status: 400 });
  }

  const query = `
    DELETE FROM feed_posts WHERE id = ${safePostId} AND seller_id = '${safeSellerId}'::uuid RETURNING id;
  `.trim();

  const rows = await runSql(query);
  if (rows === null) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

  if (Array.isArray(rows) && rows.length > 0) {
    return NextResponse.json({ success: true, deleted: true });
  }
  return NextResponse.json({ success: false, error: 'Post not found or not owned by you' }, { status: 404 });
}
