/// <reference lib="deno.ns" />
// Cellex Social Edge Function (Phase 1)
// --------------------------------------
// Implements:
//   - Public seller profile (with social stats)
//   - Follow / unfollow a seller
//   - List sellers the current user follows
//   - Activity feed: merged feed from followed sellers, or a single seller's feed
//   - Discover: list of sellers (most-followed first)
//
// API:
//   op=public_profile   body: { sellerId }            → { seller, stats, isFollowing }
//   op=follow           body: { sellerId }            → { success, isFollowing: true }
//   op=unfollow         body: { sellerId }            → { success, isFollowing: false }
//   op=following                                     → { sellers: [...] }
//   op=feed             body: { limit?, offset? }     → { items: [...] }
//   op=seller_feed      body: { sellerId, limit? }    → { items: [...] }
//   op=discover         body: { limit? }              → { sellers: [...] }

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
  supabaseSelect, supabaseInsert, supabaseDelete,
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
    const op = body.op || 'discover';

    // Public ops (no auth required)
    if (op === 'public_profile') return await handlePublicProfile(body);
    if (op === 'seller_feed')    return await handleSellerFeed(body);
    if (op === 'discover')       return await handleDiscover(body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'follow':   return await handleFollow(user.id, body);
      case 'unfollow': return await handleUnfollow(user.id, body);
      case 'following': return await handleFollowing(user.id);
      case 'feed':     return await handleFeed(user.id, body);
      default:         return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('social error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
async function handlePublicProfile(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);

  const [sellerRows, statsRows] = await Promise.all([
    supabaseSelect('sellers',
      'id,business_name,business_description,business_category,business_location,profile_image,seller_type,farm_name,created_at',
      { id: `eq.${encodeURIComponent(sellerId)}` }),
    supabaseSelect('seller_social_stats',
      'followers_count,posts_count',
      { seller_id: `eq.${encodeURIComponent(sellerId)}` }),
  ]);

  if (!sellerRows || sellerRows.length === 0) {
    return errorResponse('Seller not found', 404);
  }

  // isFollowing requires auth — caller may pass a viewerId for convenience
  let isFollowing = false;
  const viewerId = body.viewerId as string | undefined;
  if (viewerId) {
    const followRows = await supabaseSelect('seller_follows', 'id',
      { follower_id: `eq.${encodeURIComponent(viewerId)}`, seller_id: `eq.${encodeURIComponent(sellerId)}` });
    isFollowing = (followRows?.length || 0) > 0;
  }

  return jsonResponse({
    success: true,
    seller: sellerRows[0],
    stats: {
      followers: statsRows?.[0]?.followers_count || 0,
      posts: statsRows?.[0]?.posts_count || 0,
    },
    isFollowing,
  });
}

async function handleFollow(followerId: string, body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);
  if (followerId === sellerId) return errorResponse('Cannot follow yourself', 400);

  // Insert (ignore duplicates — UNIQUE constraint will reject, treat as success)
  const inserted = await supabaseInsert('seller_follows', {
    follower_id: followerId,
    seller_id: sellerId,
  });
  // inserted may be null if duplicate — that's fine
  return jsonResponse({ success: true, isFollowing: true, ignored: inserted === null });
}

async function handleUnfollow(followerId: string, body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);

  await supabaseDelete('seller_follows', {
    follower_id: `eq.${encodeURIComponent(followerId)}`,
    seller_id: `eq.${encodeURIComponent(sellerId)}`,
  });
  return jsonResponse({ success: true, isFollowing: false });
}

async function handleFollowing(followerId: string): Promise<Response> {
  // Get seller rows for all sellers this user follows
  const follows = await supabaseSelect('seller_follows', 'seller_id,created_at',
    { follower_id: `eq.${encodeURIComponent(followerId)}` },
    { order: 'created_at', ascending: false, limit: 200 });

  if (!follows || follows.length === 0) {
    return jsonResponse({ success: true, sellers: [] });
  }

  const sellerIds = follows.map(f => f.seller_id as string);
  const sellersResp = await fetch(
    `${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,business_category,profile_image,seller_type,farm_name`,
    { headers: adminHeaders }
  );
  const sellers = await sellersResp.json();

  return jsonResponse({ success: true, sellers: sellers || [] });
}

async function handleFeed(userId: string, body: Record<string, unknown>): Promise<Response> {
  const limit = Math.min(Number(body.limit) || 20, 50);
  const offset = Number(body.offset) || 0;

  // Get sellers this user follows
  const follows = await supabaseSelect('seller_follows', 'seller_id',
    { follower_id: `eq.${encodeURIComponent(userId)}` },
    { limit: 500 });

  if (!follows || follows.length === 0) {
    return jsonResponse({ success: true, items: [] });
  }

  const sellerIds = follows.map(f => f.seller_id as string);
  const feedResp = await fetch(
    `${SUPABASE_URL}/rest/v1/activity_feed?seller_id=in.(${sellerIds.join(',')})&select=id,seller_id,activity_type,entity_id,title,body,image_url,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
    { headers: adminHeaders }
  );
  const items = await feedResp.json();

  // Enrich with seller name
  const sellersResp = await fetch(
    `${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image`,
    { headers: adminHeaders }
  );
  const sellers = await sellersResp.json();
  const sellerMap = new Map((sellers || []).map((s: Record<string, unknown>) => [s.id, s]));

  const enriched = (items || []).map((item: Record<string, unknown>) => ({
    ...item,
    seller: sellerMap.get(item.seller_id) || null,
  }));

  return jsonResponse({ success: true, items: enriched });
}

async function handleSellerFeed(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);
  const limit = Math.min(Number(body.limit) || 20, 50);

  const feedResp = await fetch(
    `${SUPABASE_URL}/rest/v1/activity_feed?seller_id=eq.${encodeURIComponent(sellerId)}&select=id,activity_type,entity_id,title,body,image_url,created_at&order=created_at.desc&limit=${limit}`,
    { headers: adminHeaders }
  );
  const items = await feedResp.json();
  return jsonResponse({ success: true, items: items || [] });
}

async function handleDiscover(body: Record<string, unknown>): Promise<Response> {
  const limit = Math.min(Number(body.limit) || 12, 50);
  // Join sellers with their social stats, sort by followers_count desc
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/sellers?select=id,business_name,business_description,business_category,profile_image,seller_type,farm_name,created_at&order=created_at.desc&limit=${limit}`,
    { headers: adminHeaders }
  );
  const sellers = await resp.json();

  // Fetch stats for these sellers
  const sellerIds = (sellers || []).map((s: Record<string, unknown>) => s.id);
  if (sellerIds.length === 0) return jsonResponse({ success: true, sellers: [] });

  const statsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/seller_social_stats?seller_id=in.(${sellerIds.join(',')})&select=seller_id,followers_count,posts_count`,
    { headers: adminHeaders }
  );
  const stats = await statsResp.json();
  const statsMap = new Map((stats || []).map((s: Record<string, unknown>) => [s.seller_id, s]));

  const enriched = (sellers || []).map((s: Record<string, unknown>) => ({
    ...s,
    followers: statsMap.get(s.id)?.followers_count || 0,
    posts: statsMap.get(s.id)?.posts_count || 0,
  })).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    Number(b.followers) - Number(a.followers));

  return jsonResponse({ success: true, sellers: enriched });
}
