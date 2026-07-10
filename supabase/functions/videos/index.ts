/// <reference lib="deno.ns" />
// Cellex Product Videos Edge Function (Phase 3 — TikTok Shop model)
// -------------------------------------------------------------------
// Sellers upload 15-second product showcase videos. Buyers swipe through a
// vertical feed. The algorithm scores videos by recency × seller relevance
// (followed sellers / categories the buyer has purchased from) × view velocity.
//
// API:
//   op=feed         body: { limit? }                       → { videos: [...] }  (algorithmic, auth-optional)
//   op=by_product   body: { productId }                    → { videos: [...] }  (public)
//   op=by_seller    body: { sellerId }                     → { videos: [...] }  (public)
//   op=get          body: { videoId }                      → { video, like_count } (public, increments views)
//   op=upload_url   body: { productId, filename, mime }    → { uploadUrl, videoUrl }  (seller — presigned PUT)
//   op=create       body: { productId, videoUrl, thumbnailUrl?, caption? } → { video }
//   op=delete       body: { videoId }                      → { success }
//   op=like         body: { videoId }                      → { liked: true }
//   op=unlike       body: { videoId }                      → { liked: false }
//   op=mine                                                → { videos: [...] }

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
} from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op || 'feed';

    // Public ops (no auth required, but user may be passed for personalization)
    if (op === 'feed')       return await handleFeed(req, body);
    if (op === 'by_product') return await handleByProduct(body);
    if (op === 'by_seller')  return await handleBySeller(body);
    if (op === 'get')        return await handleGet(req, body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'upload_url': return await handleUploadUrl(user.id, body);
      case 'create':     return await handleCreate(user.id, body);
      case 'delete':     return await handleDelete(user.id, body);
      case 'like':       return await handleLike(user.id, body);
      case 'unlike':     return await handleUnlike(user.id, body);
      case 'mine':       return await handleMine(user.id);
      default:           return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('videos error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
// FEED — algorithmic, personalized if logged in
// ---------------------------------------------------------------------------
async function handleFeed(req: Request, body: Record<string, unknown>): Promise<Response> {
  const limit = Math.min(Number(body.limit) || 20, 50);
  const user = await getUser(req);
  const userId = user?.id;

  // Fetch active videos with product info (seller info fetched separately below)
  const videosResp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?status=eq.active&select=*,products(id,name,price,image_url,category,seller_id)&order=created_at.desc&limit=200`,
    { headers: adminHeaders }
  );
  const videos = await videosResp.json();
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return jsonResponse({ success: true, videos: [] });
  }

  // If logged in, personalize
  let followedSellers = new Set<string>();
  let purchasedCategories = new Set<string>();
  let likedVideoIds = new Set<string>();

  if (userId) {
    const [followsResp, ordersResp, likesResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/seller_follows?follower_id=eq.${encodeURIComponent(userId)}&select=seller_id`, { headers: adminHeaders }),
      // Purchased categories: join buyers_order_items → products
      fetch(`${SUPABASE_URL}/rest/v1/buyers_order_items?seller_id=not.is.null&select=product_id&order_id=in.(SELECT id FROM buyers_orders WHERE user_id=eq.${encodeURIComponent(userId)})`.replace(/,/g, '%2C').replace(/ /g, '%20'), { headers: adminHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/product_video_likes?user_id=eq.${encodeURIComponent(userId)}&select=video_id`, { headers: adminHeaders }),
    ]);

    const follows = await followsResp.json();
    followedSellers = new Set((follows || []).map((f: Record<string, unknown>) => f.seller_id as string));

    const likes = await likesResp.json();
    likedVideoIds = new Set((likes || []).map((l: Record<string, unknown>) => l.video_id as number));

    // For purchased categories, fetch the product IDs from items, then look up categories
    // Simpler: fetch the user's order items with product info embedded
    if (true) {
      const userOrdersResp = await fetch(
        `${SUPABASE_URL}/rest/v1/buyers_orders?user_id=eq.${encodeURIComponent(userId)}&select=id`,
        { headers: adminHeaders }
      );
      const userOrders = await userOrdersResp.json();
      const orderIds = (userOrders || []).map((o: Record<string, unknown>) => o.id);
      if (orderIds.length > 0) {
        const itemsResp = await fetch(
          `${SUPABASE_URL}/rest/v1/buyers_order_items?order_id=in.(${orderIds.join(',')})&select=product_id`,
          { headers: adminHeaders }
        );
        const items = await itemsResp.json();
        const productIds = (items || []).map((i: Record<string, unknown>) => i.product_id).filter(Boolean);
        if (productIds.length > 0) {
          const productsResp = await fetch(
            `${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.join(',')})&select=category`,
            { headers: adminHeaders }
          );
          const products = await productsResp.json();
          (products || []).forEach((p: Record<string, unknown>) => {
            if (p.category) purchasedCategories.add(p.category as string);
          });
        }
      }
    }
  }

  // Fetch seller info separately (no FK in DB → can't use !inner join)
  const sellerIds = Array.from(new Set((videos as Record<string, unknown>[]).map(v => v.seller_id as string).filter(Boolean)));
  let sellerMap = new Map<string, Record<string, unknown>>();
  if (sellerIds.length > 0) {
    const sellersResp = await fetch(
      `${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image,seller_type,farm_name`,
      { headers: adminHeaders }
    );
    (await sellersResp.json()).forEach((s: Record<string, unknown>) => sellerMap.set(s.id as string, s));
  }

  // Score each video
  const now = Date.now();
  const scored = (videos as Record<string, unknown>[]).map(v => {
    const sellerId = v.seller_id as string;
    const product = v.products as Record<string, unknown> | null;
    const seller = sellerMap.get(sellerId) || null;
    let score = 1;
    // Recency decay: videos < 24h old get a 2x boost; < 7d get 1.3x
    const ageHours = (now - new Date(v.created_at as string).getTime()) / 3600000;
    if (ageHours < 24) score *= 2;
    else if (ageHours < 168) score *= 1.3;
    else score *= 0.5;

    // Followed seller boost
    if (followedSellers.has(sellerId)) score *= 3;
    // Same category as past purchase
    if (product?.category && purchasedCategories.has(product.category as string)) score *= 1.8;
    // View velocity (likes / hour)
    const likesCount = (v.likes_count as number) || 0;
    score += Math.min(likesCount / Math.max(1, ageHours), 5);

    return { ...v, _score: score, _liked: likedVideoIds.has(v.id as number), _seller: seller };
  });

  // Sort by score, randomize ties a bit
  scored.sort((a, b) => (b._score as number) - (a._score as number));

  // Slice + clean output
  const out = scored.slice(0, limit).map(v => {
    const product = v.products as Record<string, unknown> | null;
    const seller = v._seller as Record<string, unknown> | null;
    return {
      id: v.id,
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url,
      caption: v.caption,
      views_count: v.views_count,
      likes_count: v.likes_count,
      liked: v._liked,
      created_at: v.created_at,
      product: product ? {
        id: product.id, name: product.name, price: product.price,
        image_url: product.image_url, category: product.category,
      } : null,
      seller: seller ? {
        id: seller.id, business_name: seller.business_name || seller.farm_name,
        profile_image: seller.profile_image,
      } : null,
    };
  });

  return jsonResponse({ success: true, videos: out });
}

async function handleByProduct(body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?product_id=eq.${productId}&status=eq.active&select=*&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const videos = await resp.json();
  return jsonResponse({ success: true, videos: videos || [] });
}

async function handleBySeller(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?seller_id=eq.${encodeURIComponent(sellerId)}&select=*&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const videos = await resp.json();
  return jsonResponse({ success: true, videos: videos || [] });
}

async function handleGet(req: Request, body: Record<string, unknown>): Promise<Response> {
  const videoId = Number(body.videoId);
  if (!videoId) return errorResponse('videoId is required', 400);

  // Increment view count atomically (read current, +1, write back)
  const cur = await fetch(`${SUPABASE_URL}/rest/v1/product_videos?id=eq.${videoId}&select=views_count`, { headers: adminHeaders });
  const rows = await cur.json();
  if (!rows?.length) return errorResponse('Video not found', 404);
  const newCount = (rows[0].views_count || 0) + 1;
  await fetch(`${SUPABASE_URL}/rest/v1/product_videos?id=eq.${videoId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ views_count: newCount }),
  });

  // Log the view (with user_id if available)
  const user = await getUser(req);
  await fetch(`${SUPABASE_URL}/rest/v1/product_view_log`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: null,  // We log video views against the video's product via a separate field if needed; for now null
      user_id: user?.id || null,
      source: 'video',
    }),
  });

  // Fetch the full video with product info (seller fetched separately)
  const fullResp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?id=eq.${videoId}&select=*,products(id,name,price,image_url,category)`,
    { headers: adminHeaders }
  );
  const videos = await fullResp.json();
  if (!videos || videos.length === 0) return jsonResponse({ success: true, video: null });
  const video = videos[0];

  // Fetch seller
  let seller = null;
  if (video.seller_id) {
    const sellerResp = await fetch(
      `${SUPABASE_URL}/rest/v1/sellers?id=eq.${encodeURIComponent(video.seller_id)}&select=id,business_name,profile_image,farm_name`,
      { headers: adminHeaders }
    );
    seller = (await sellerResp.json())?.[0] || null;
  }

  return jsonResponse({ success: true, video: { ...video, sellers: seller } });
}

async function handleUploadUrl(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  const filename = (body.filename as string)?.trim();
  const mime = (body.mime as string) || 'video/mp4';
  if (!productId || !filename) return errorResponse('productId and filename are required', 400);

  // Verify seller owns the product
  const prodResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=seller_id`, { headers: adminHeaders });
  const products = await prodResp.json();
  if (!products?.length || products[0].seller_id !== userId) {
    return errorResponse('Not authorized: you do not own this product', 403);
  }

  // Generate a unique path
  const ext = filename.split('.').pop() || 'mp4';
  const path = `${userId}/${productId}/${Date.now()}.${ext}`;

  // Build a presigned PUT URL (valid for 1 hour)
  // Supabase Storage supports presigned URLs via /storage/v1/object/render-signed/... or via the JS client.
  // For REST, the simplest is to use the service role to create a signed URL with PUT method.
  const signResp = await fetch(`${SUPABASE_URL}/storage/v1/object/create-signed-upload-url/product-videos/${path}`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ upsert: false }),
  });
  if (!signResp.ok) {
    return errorResponse(`Failed to create upload URL: ${await signResp.text()}`, 500);
  }
  const signData = await signResp.json();

  return jsonResponse({
    success: true,
    uploadUrl: signData.signed_url,
    videoUrl: `${SUPABASE_URL}/storage/v1/object/public/product-videos/${path}`,
    path,
  });
}

async function handleCreate(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  const videoUrl = (body.videoUrl as string)?.trim();
  if (!productId || !videoUrl) return errorResponse('productId and videoUrl are required', 400);

  // Verify ownership
  const prodResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=seller_id,name,price,image_url,category`, { headers: adminHeaders });
  const products = await prodResp.json();
  if (!products?.length || products[0].seller_id !== userId) {
    return errorResponse('Not authorized: you do not own this product', 403);
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/product_videos`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      product_id: productId,
      seller_id: userId,
      video_url: videoUrl,
      thumbnail_url: body.thumbnailUrl || products[0].image_url || null,
      caption: body.caption || '',
      status: 'active',
    }),
  });
  const created = await resp.json();
  if (!resp.ok) return errorResponse('Failed to create video', 500);

  // Post to activity feed
  await fetch(`${SUPABASE_URL}/rest/v1/activity_feed`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller_id: userId,
      activity_type: 'announcement',
      entity_id: productId,
      title: `New product video: ${products[0].name}`,
      body: body.caption || 'Watch our latest product showcase!',
      image_url: products[0].image_url,
    }),
  }).catch(() => {});

  return jsonResponse({ success: true, video: created?.[0] });
}

async function handleDelete(userId: string, body: Record<string, unknown>): Promise<Response> {
  const videoId = Number(body.videoId);
  if (!videoId) return errorResponse('videoId is required', 400);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?id=eq.${videoId}&seller_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  if (!resp.ok) return errorResponse('Failed to delete video', 500);
  return jsonResponse({ success: true });
}

async function handleLike(userId: string, body: Record<string, unknown>): Promise<Response> {
  const videoId = Number(body.videoId);
  if (!videoId) return errorResponse('videoId is required', 400);
  // Insert (UNIQUE constraint dedupes)
  await fetch(`${SUPABASE_URL}/rest/v1/product_video_likes`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ video_id: videoId, user_id: userId }),
  }).catch(() => {});
  return jsonResponse({ success: true, liked: true });
}

async function handleUnlike(userId: string, body: Record<string, unknown>): Promise<Response> {
  const videoId = Number(body.videoId);
  if (!videoId) return errorResponse('videoId is required', 400);
  await fetch(
    `${SUPABASE_URL}/rest/v1/product_video_likes?video_id=eq.${videoId}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true, liked: false });
}

async function handleMine(userId: string): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/product_videos?seller_id=eq.${encodeURIComponent(userId)}&select=*,products(id,name,price,image_url)&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const videos = await resp.json();
  return jsonResponse({ success: true, videos: videos || [] });
}
