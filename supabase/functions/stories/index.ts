/// <reference lib="deno.ns" />
// Cellex Seller Stories Edge Function (Phase 3 — Instagram-style)
// ----------------------------------------------------------------
// Sellers post daily/weekly stories (new stock, deals, behind-the-scenes).
// Stories expire after 24 hours. Buyers see a stories bar at the top of the
// home page (like Instagram). Each view increments the story's view count.
//
// API:
//   op=active_bar                                     → { stories: [{ seller_id, business_name, profile_image, story_count, latest_created_at, has_unseen }] } (auth-optional)
//   op=by_seller    body: { sellerId }                → { stories: [...] } (public)
//   op=get          body: { storyId }                 → { story } (increments view)
//   op=mark_seen    body: { storyIds: [] }            → { success }
//   op=create       body: { storyType, title, body, imageUrl?, videoUrl?, productId? } (seller)
//   op=mine                                              → { stories: [...] } (seller)
//   op=delete       body: { storyId }                  → { success } (seller)

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
    const op = body.op || 'active_bar';

    // Public ops
    if (op === 'active_bar') return await handleActiveBar(req);
    if (op === 'by_seller')  return await handleBySeller(body);
    if (op === 'get')        return await handleGet(req, body);

    // Auth-required
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'mark_seen': return await handleMarkSeen(user.id, body);
      case 'create':    return await handleCreate(user.id, body);
      case 'mine':      return await handleMine(user.id);
      case 'delete':    return await handleDelete(user.id, body);
      default:          return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('stories error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleActiveBar(req: Request): Promise<Response> {
  // Get all stories that haven't expired, grouped by seller
  const nowIso = new Date().toISOString();
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/seller_stories?expires_at=gt.${encodeURIComponent(nowIso)}&select=id,seller_id,created_at,story_type,title,image_url,video_url&order=seller_id,created_at.desc`,
    { headers: adminHeaders }
  );
  const stories = await resp.json();

  // Group by seller
  const bySeller = new Map<string, Record<string, unknown>[]>();
  (stories || []).forEach((s: Record<string, unknown>) => {
    const sid = s.seller_id as string;
    if (!bySeller.has(sid)) bySeller.set(sid, []);
    bySeller.get(sid)!.push(s);
  });

  // Get seller info
  const sellerIds = Array.from(bySeller.keys());
  if (sellerIds.length === 0) return jsonResponse({ success: true, stories: [] });

  const sellersResp = await fetch(
    `${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image,farm_name,seller_type`,
    { headers: adminHeaders }
  );
  const sellers = await sellersResp.json();
  const sellerMap = new Map((sellers || []).map((s: Record<string, unknown>) => [s.id, s]));

  // Get the user's "seen" stories if logged in
  const user = await getUser(req);
  let seenStoryIds = new Set<number>();
  if (user) {
    const seenResp = await fetch(
      `${SUPABASE_URL}/rest/v1/seller_story_views?user_id=eq.${encodeURIComponent(user.id)}&select=story_id`,
      { headers: adminHeaders }
    );
    const seen = await seenResp.json();
    seenStoryIds = new Set((seen || []).map((s: Record<string, unknown>) => s.story_id as number));
  }

  const out = Array.from(bySeller.entries()).map(([sid, sellerStories]) => {
    const seller = sellerMap.get(sid);
    const hasUnseen = sellerStories.some(s => !seenStoryIds.has(s.id as number));
    return {
      seller_id: sid,
      business_name: seller?.business_name || seller?.farm_name || 'Seller',
      profile_image: seller?.profile_image,
      seller_type: seller?.seller_type,
      story_count: sellerStories.length,
      latest_created_at: sellerStories[0].created_at,
      has_unseen: hasUnseen,
      stories: sellerStories.map(s => ({
        id: s.id,
        story_type: s.story_type,
        title: s.title,
        image_url: s.image_url,
        video_url: s.video_url,
        created_at: s.created_at,
        seen: seenStoryIds.has(s.id as number),
      })),
    };
  });

  return jsonResponse({ success: true, stories: out });
}

async function handleBySeller(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);
  const nowIso = new Date().toISOString();
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/seller_stories?seller_id=eq.${encodeURIComponent(sellerId)}&expires_at=gt.${encodeURIComponent(nowIso)}&select=*&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const stories = await resp.json();
  return jsonResponse({ success: true, stories: stories || [] });
}

async function handleGet(req: Request, body: Record<string, unknown>): Promise<Response> {
  const storyId = Number(body.storyId);
  if (!storyId) return errorResponse('storyId is required', 400);

  // Fetch + increment views_count atomically (read-then-write since RPCs are not configured)
  const cur = await fetch(`${SUPABASE_URL}/rest/v1/seller_stories?id=eq.${storyId}&select=*`, { headers: adminHeaders });
  const rows = await cur.json();
  if (!rows?.length) return errorResponse('Story not found', 404);
  const story = rows[0];
  await fetch(`${SUPABASE_URL}/rest/v1/seller_stories?id=eq.${storyId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ views_count: (story.views_count || 0) + 1 }),
  });

  // Mark as seen if logged in
  const user = await getUser(req);
  if (user) {
    await fetch(`${SUPABASE_URL}/rest/v1/seller_story_views`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify({ story_id: storyId, user_id: user.id }),
    }).catch(() => {});  // UNIQUE constraint will reject duplicates — fine
  }

  // Get product info if attached
  let product = null;
  if (story.product_id) {
    const pResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${story.product_id}&select=id,name,price,image_url`, { headers: adminHeaders });
    product = (await pResp.json())?.[0] || null;
  }

  return jsonResponse({ success: true, story: { ...story, views_count: (story.views_count || 0) + 1, product } });
}

async function handleMarkSeen(userId: string, body: Record<string, unknown>): Promise<Response> {
  const storyIds = (body.storyIds as number[]) || [];
  if (storyIds.length === 0) return errorResponse('storyIds is required', 400);
  // Bulk insert (UNIQUE constraint dedupes)
  const rows = storyIds.map(sid => ({ story_id: sid, user_id: userId }));
  await fetch(`${SUPABASE_URL}/rest/v1/seller_story_views`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(rows),
  }).catch(() => {});
  return jsonResponse({ success: true });
}

async function handleCreate(userId: string, body: Record<string, unknown>): Promise<Response> {
  const title = (body.title as string)?.trim() || '';
  const bodyText = (body.body as string)?.trim() || '';
  if (!title && !bodyText && !body.imageUrl && !body.videoUrl) {
    return errorResponse('Story must have at least a title, body, image, or video', 400);
  }

  const payload: Record<string, unknown> = {
    seller_id: userId,
    story_type: (body.storyType as string) || 'announcement',
    title,
    body: bodyText,
    image_url: body.imageUrl || null,
    video_url: body.videoUrl || null,
    expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
  };
  if (body.productId) payload.product_id = Number(body.productId);

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/seller_stories`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  const created = await resp.json();
  if (!resp.ok) return errorResponse('Failed to create story', 500);

  // Also post to activity feed
  await fetch(`${SUPABASE_URL}/rest/v1/activity_feed`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller_id: userId,
      activity_type: 'announcement',
      title: title || 'New story',
      body: bodyText,
      image_url: body.imageUrl || null,
    }),
  }).catch(() => {});

  return jsonResponse({ success: true, story: created?.[0] });
}

async function handleMine(userId: string): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/seller_stories?seller_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`,
    { headers: adminHeaders }
  );
  const stories = await resp.json();
  return jsonResponse({ success: true, stories: stories || [] });
}

async function handleDelete(userId: string, body: Record<string, unknown>): Promise<Response> {
  const storyId = Number(body.storyId);
  if (!storyId) return errorResponse('storyId is required', 400);
  await fetch(
    `${SUPABASE_URL}/rest/v1/seller_stories?id=eq.${storyId}&seller_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true });
}
