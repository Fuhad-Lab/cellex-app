/// <reference lib="deno.ns" />
// Cellex Live Shopping Edge Function (Phase 2 — Whatnot model)
// --------------------------------------------------------------
// Sellers go live with a video stream (YouTube/HLS/Twitch URL) or text-only.
// Buyers join, chat in real time, and click "Buy" to purchase the featured product.
//
// For MVP, real-time is via polling (every 2-3 seconds) instead of WebSocket
// to keep infra simple. Buyers send chat messages; everyone polls.
//
// WhatsApp integration: the WhatsApp bot (Render) calls /live op=whatsapp_buy
// when a user texts "buy" during an active session.
//
// API:
//   op=list         body: { status? }                  → { sessions: [...] }       (public)
//   op=get          body: { sessionId }                → { session, viewers: [...] } (public)
//   op=messages     body: { sessionId, afterId? }      → { messages: [...] }       (public)
//
//   op=start        body: { title, description?, streamUrl?, streamPlatform?, featuredProductId? } (seller)
//   op=end          body: { sessionId }                                              (seller)
//   op=join         body: { sessionId, name? }                                       (auth)
//   op=leave        body: { sessionId }                                              (auth)
//   op=message      body: { sessionId, message }                                     (auth)
//   op=mynext                                                                         (seller — get seller's next session)
//
//   op=whatsapp_buy body: { sessionId, phone, name }                                 (called by WhatsApp bot)

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
    const op = body.op || 'list';

    // Public ops
    if (op === 'list')     return await handleList(body);
    if (op === 'get')      return await handleGet(body);
    if (op === 'messages') return await handleMessages(body);
    if (op === 'whatsapp_buy') return await handleWhatsappBuy(body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'start':   return await handleStart(user.id, body);
      case 'end':     return await handleEnd(user.id, body);
      case 'join':    return await handleJoin(user.id, body);
      case 'leave':   return await handleLeave(user.id, body);
      case 'message': return await handleMessage(user.id, body);
      case 'mynext':  return await handleMyNext(user.id);
      default:        return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('live error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
async function handleList(body: Record<string, unknown>): Promise<Response> {
  const status = (body.status as string) || 'live';
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_live_sessions?status=eq.${status}&select=id,seller_id,title,description,stream_url,stream_platform,featured_product_id,viewer_count,started_at,ended_at,created_at&order=started_at.desc&limit=50`,
    { headers: adminHeaders }
  );
  const sessions = await resp.json();

  // Enrich with seller info + featured product
  const sellerIds = Array.from(new Set((sessions || []).map((s: Record<string, unknown>) => s.seller_id)));
  let sellerMap = new Map<string, Record<string, unknown>>();
  if (sellerIds.length > 0) {
    const sellersResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image`, { headers: adminHeaders });
    (await sellersResp.json()).forEach((s: Record<string, unknown>) => sellerMap.set(s.id as string, s));
  }

  const enriched = (sessions || []).map((s: Record<string, unknown>) => ({
    ...s,
    seller: sellerMap.get(s.seller_id as string) || null,
  }));

  return jsonResponse({ success: true, sessions: enriched });
}

async function handleGet(body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return errorResponse('sessionId is required', 400);

  const [sessResp, viewersResp, featuredResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers?live_session_id=eq.${encodeURIComponent(sessionId)}&select=user_id,user_name,joined_at&order=joined_at.desc&limit=100`, { headers: adminHeaders }),
  ]);

  const sessions = await sessResp.json();
  const viewers = await viewersResp.json();
  if (!sessions || sessions.length === 0) return errorResponse('Live session not found', 404);
  const session = sessions[0];

  // Featured product
  let featured = null;
  if (session.featured_product_id) {
    const pResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${session.featured_product_id}&select=id,name,price,image_url,seller_id`, { headers: adminHeaders });
    featured = (await pResp.json())?.[0] || null;
  }

  // Seller info
  const sellerResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers?id=eq.${encodeURIComponent(session.seller_id)}&select=id,business_name,profile_image`, { headers: adminHeaders });
  const seller = (await sellerResp.json())?.[0] || null;

  return jsonResponse({
    success: true,
    session: { ...session, seller, featured },
    viewers: viewers || [],
  });
}

async function handleMessages(body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return errorResponse('sessionId is required', 400);
  const afterId = Number(body.afterId) || 0;
  const limit = Math.min(Number(body.limit) || 50, 200);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_live_messages?live_session_id=eq.${encodeURIComponent(sessionId)}&id=gt.${afterId}&select=*&order=id.desc&limit=${limit}`,
    { headers: adminHeaders }
  );
  const messages = await resp.json();
  // Reverse so oldest is first
  return jsonResponse({ success: true, messages: (messages || []).reverse() });
}

async function handleStart(userId: string, body: Record<string, unknown>): Promise<Response> {
  const title = (body.title as string)?.trim();
  if (!title) return errorResponse('title is required', 400);

  // Verify the user has a seller row
  const sellerResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers?id=eq.${encodeURIComponent(userId)}&select=id,business_name`, { headers: adminHeaders });
  const sellers = await sellerResp.json();
  if (!sellers || sellers.length === 0) return errorResponse('Only sellers can go live', 403);

  const payload: Record<string, unknown> = {
    seller_id: userId,
    title,
    description: (body.description as string) || '',
    stream_url: (body.streamUrl as string) || null,
    stream_platform: (body.streamPlatform as string) || 'none',
    status: 'live',
    started_at: new Date().toISOString(),
    viewer_count: 1,
  };
  if (body.featuredProductId) payload.featured_product_id = Number(body.featuredProductId);

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  const created = await resp.json();
  if (!resp.ok) return errorResponse('Failed to start live session', 500);
  const session = created[0];

  // Auto-join seller as a viewer
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      live_session_id: session.id,
      user_id: userId,
      user_name: sellers[0].business_name || 'Host',
    }),
  });

  // System message
  await postSystemMessage(session.id, `🔴 Live now: ${title}`);

  // Phase 4: Auto-broadcast to Telegram via the Render bot (fire-and-forget)
  const BOT_RENDER_URL = Deno.env.get('BOT_RENDER_URL') || 'https://eesha-shop-buying-and-selling.onrender.com';
  const BOT_INTERNAL_KEY = Deno.env.get('BOT_INTERNAL_KEY') || 'CellexInternal2024';
  fetch(`${BOT_RENDER_URL}/internal/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': BOT_INTERNAL_KEY,
    },
    body: JSON.stringify({
      broadcast_type: 'live_start',
      entity_id: session.id,
      message: `🔴 <b>LIVE NOW:</b> ${escapeHtml(title)}\n${(body.description as string) || ''}\n\nWatch: https://eeshaai-cellex-web.hf.space/live-watch.html?id=${session.id}`,
    }),
  }).catch(() => {});

  return jsonResponse({ success: true, session });
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function handleEnd(userId: string, body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return errorResponse('sessionId is required', 400);

  // Verify ownership
  const check = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}&seller_id=eq.${encodeURIComponent(userId)}&select=id`, { headers: adminHeaders });
  if (!(await check.json())?.length) return errorResponse('Not authorized to end this session', 403);

  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ended', ended_at: new Date().toISOString() }),
  });

  await postSystemMessage(sessionId, '⚪ Live session ended.');

  // Clear viewers
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers?live_session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'DELETE', headers: adminHeaders,
  });

  return jsonResponse({ success: true });
}

async function handleJoin(userId: string, body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return errorResponse('sessionId is required', 400);

  const name = (body.name as string) || 'Guest';

  // Insert viewer (UNIQUE constraint dedupes)
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      live_session_id: sessionId,
      user_id: userId,
      user_name: name,
    }),
  }).catch(() => {});  // ignore duplicate errors

  // Update viewer_count
  const countResp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers?live_session_id=eq.${encodeURIComponent(sessionId)}&select=id`, { headers: adminHeaders });
  const count = (await countResp.json()).length;
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewer_count: count }),
  });

  // System message
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_messages`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      live_session_id: sessionId,
      user_id: userId,
      user_name: name,
      msg_type: 'join',
      message: `${name} joined`,
    }),
  });

  return jsonResponse({ success: true, viewer_count: count });
}

async function handleLeave(userId: string, body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return errorResponse('sessionId is required', 400);

  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers?live_session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE', headers: adminHeaders,
  });

  // Update count
  const countResp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_viewers?live_session_id=eq.${encodeURIComponent(sessionId)}&select=id`, { headers: adminHeaders });
  const count = (await countResp.json()).length;
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewer_count: count }),
  });

  return jsonResponse({ success: true, viewer_count: count });
}

async function handleMessage(userId: string, body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  const message = (body.message as string)?.trim();
  if (!sessionId || !message) return errorResponse('sessionId and message are required', 400);

  // Get user name from sellers table (works for both buyers and sellers since the
  // seller row is auto-provisioned for any auth user on first seller-dashboard call)
  let userName = 'Guest';
  const sellerResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers?id=eq.${encodeURIComponent(userId)}&select=business_name,email`, { headers: adminHeaders });
  const sellers = await sellerResp.json();
  if (sellers?.[0]) {
    userName = sellers[0].business_name || (sellers[0].email || 'Guest').split('@')[0];
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_messages`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      live_session_id: sessionId,
      user_id: userId,
      user_name: userName,
      msg_type: 'chat',
      message,
    }),
  });
  const created = await resp.json();
  return jsonResponse({ success: true, message: created?.[0] });
}

async function handleMyNext(userId: string): Promise<Response> {
  // Get seller's most recent live session (live or scheduled)
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_live_sessions?seller_id=eq.${encodeURIComponent(userId)}&status=in.(live,scheduled)&select=*&order=created_at.desc&limit=1`,
    { headers: adminHeaders }
  );
  const sessions = await resp.json();
  return jsonResponse({ success: true, session: sessions?.[0] || null });
}

// WhatsApp "buy" command — called by the WhatsApp bot when a user texts "buy"
// during a live session. We record a purchase message in the chat and return
// the checkout URL so the bot can send it back to the user.
async function handleWhatsappBuy(body: Record<string, unknown>): Promise<Response> {
  const sessionId = body.sessionId as string;
  const phone = (body.phone as string)?.trim();
  const name = (body.name as string) || 'WhatsApp buyer';
  if (!sessionId || !phone) return errorResponse('sessionId and phone are required', 400);

  // Verify session is live
  const sessResp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?id=eq.${encodeURIComponent(sessionId)}&status=eq.live&select=id,featured_product_id,seller_id,title`, { headers: adminHeaders });
  const sessions = await sessResp.json();
  if (!sessions?.length) return errorResponse('No active live session', 404);
  const session = sessions[0];

  if (!session.featured_product_id) {
    return errorResponse('No featured product in this live session', 400);
  }

  // Post a purchase message to the chat
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_messages`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      live_session_id: sessionId,
      user_name: name,
      msg_type: 'purchase',
      message: `${name} just bought the featured product! 🎉`,
    }),
  });

  // Return the checkout URL — the WhatsApp bot will send this back to the user
  const checkoutUrl = `https://eeshaai-cellex-web.hf.space/Eesha buying folder/product.html?id=${session.featured_product_id}&live=${sessionId}`;

  return jsonResponse({
    success: true,
    sessionId,
    productId: session.featured_product_id,
    checkoutUrl,
    reply: `🛒 Thanks for buying during our live! Complete your purchase here: ${checkoutUrl}`,
  });
}

// ---------------------------------------------------------------------------
async function postSystemMessage(sessionId: string, message: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/shop_live_messages`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      live_session_id: sessionId,
      msg_type: 'system',
      message,
    }),
  });
}
