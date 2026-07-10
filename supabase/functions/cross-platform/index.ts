/// <reference lib="deno.ns" />
// Cellex Cross-Platform Edge Function (Phase 4)
// ----------------------------------------------
// Bridges the WhatsApp bot (on Render) and the web app:
//   - Account linking: web user generates 6-digit code, texts it to the WhatsApp bot,
//     bot calls bot_link_account to confirm the phone ↔ user_id mapping.
//   - Unified cart: bot can fetch / add to / remove from a user's cart by phone.
//   - Group buying via bot: bot joins a group buy on behalf of a user.
//   - Product discovery: bot fetches product info, searches, lists active group buys / live sessions.
//
// Authentication:
//   - Web-side ops (generate_link_code, my_phone_links, unlink_phone) use the standard
//     HTTP-only cookie session via getUser(req).
//   - Bot-side ops (bot_*) require an X-Bot-Api-Key header matching env BOT_API_KEY.
//     This prevents random callers from injecting cart items on behalf of users.

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
} from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOT_API_KEY = Deno.env.get('BOT_API_KEY') || 'CellexBot2024';

const adminHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

function genCode(): string {
  // 6-digit code
  let c = '';
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10).toString();
  return c;
}

function normalizePhone(p: string): string {
  // Strip everything but digits and +, ensure leading +
  let s = (p || '').replace(/[^\d+]/g, '');
  if (!s.startsWith('+')) s = '+' + s;
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op || '';

    // ---- Web-side ops (cookie auth) ----
    if (op === 'generate_link_code') return await handleGenerateLinkCode(req, body);
    if (op === 'my_phone_links')     return await handleMyPhoneLinks(req);
    if (op === 'unlink_phone')       return await handleUnlinkPhone(req, body);

    // ---- Bot-side ops (X-Bot-Api-Key header) ----
    const botKey = req.headers.get('X-Bot-Api-Key') || '';
    if (botKey !== BOT_API_KEY) {
      return errorResponse('Invalid bot API key', 401);
    }

    switch (op) {
      case 'bot_link_account':        return await handleBotLinkAccount(body);
      case 'bot_get_cart':            return await handleBotGetCart(body);
      case 'bot_add_to_cart':         return await handleBotAddToCart(body);
      case 'bot_remove_from_cart':    return await handleBotRemoveFromCart(body);
      case 'bot_clear_cart':          return await handleBotClearCart(body);
      case 'bot_checkout':            return await handleBotCheckout(body);
      case 'bot_join_group_buy':      return await handleBotJoinGroupBuy(body);
      case 'bot_get_product':         return await handleBotGetProduct(body);
      case 'bot_search':              return await handleBotSearch(body);
      case 'bot_get_active_group_buys': return await handleBotGetActiveGroupBuys(body);
      case 'bot_get_live_sessions':   return await handleBotGetLiveSessions(body);
      case 'bot_get_seller_products': return await handleBotGetSellerProducts(body);
      default:                        return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('cross-platform error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
// WEB-SIDE OPS
// ---------------------------------------------------------------------------

async function handleGenerateLinkCode(req: Request, body: Record<string, unknown>): Promise<Response> {
  const user = await getUser(req);
  if (!user) return errorResponse('Not authenticated', 401);
  const phone = normalizePhone(body.phone as string);
  if (!phone || phone.length < 10) return errorResponse('Valid phone required', 400);

  // Delete any prior unconfirmed code for this user+phone
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?user_id=eq.${encodeURIComponent(user.id)}&phone=eq.${encodeURIComponent(phone)}&confirmed_at=is.null`,
    { method: 'DELETE', headers: adminHeaders }
  );

  // Generate a unique code (retry on collision)
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = genCode();
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/user_phone_links?link_code=eq.${code}&select=id`,
      { headers: adminHeaders }
    );
    if ((await check.json()).length === 0) break;
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/user_phone_links`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ user_id: user.id, phone, link_code: code }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return errorResponse(`Failed to create link code: ${err}`, 500);
  }

  return jsonResponse({
    success: true,
    code,
    phone,
    instructions: `Text this code to the Cellex WhatsApp bot to link your account: ${code}`,
  });
}

async function handleMyPhoneLinks(req: Request): Promise<Response> {
  const user = await getUser(req);
  if (!user) return errorResponse('Not authenticated', 401);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?user_id=eq.${encodeURIComponent(user.id)}&select=id,phone,link_code,confirmed_at,created_at&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const links = await resp.json();
  return jsonResponse({ success: true, links: links || [] });
}

async function handleUnlinkPhone(req: Request, body: Record<string, unknown>): Promise<Response> {
  const user = await getUser(req);
  if (!user) return errorResponse('Not authenticated', 401);
  const phone = normalizePhone(body.phone as string);
  if (!phone) return errorResponse('phone required', 400);
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?user_id=eq.${encodeURIComponent(user.id)}&phone=eq.${encodeURIComponent(phone)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// BOT-SIDE OPS — these run with the service role key, called by the WhatsApp bot
// ---------------------------------------------------------------------------

async function handleBotLinkAccount(body: Record<string, unknown>): Promise<Response> {
  const code = (body.code as string || '').trim();
  const phone = normalizePhone(body.phone as string);
  if (!code || !phone) return errorResponse('code and phone required', 400);

  // Find the pending link row
  const findResp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?link_code=eq.${encodeURIComponent(code)}&confirmed_at=is.null&select=id,user_id,phone,created_at`,
    { headers: adminHeaders }
  );
  const rows = await findResp.json();
  if (!rows || rows.length === 0) return errorResponse('Invalid or expired link code', 404);
  const link = rows[0];

  // Codes expire after 10 minutes
  if (Date.now() - new Date(link.created_at).getTime() > 10 * 60 * 1000) {
    return errorResponse('Link code expired — please generate a new one', 410);
  }

  // Confirm the link — mark confirmed_at, store the phone from the bot
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?id=eq.${link.id}`,
    {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_at: new Date().toISOString(), phone }),
    }
  );

  return jsonResponse({
    success: true,
    user_id: link.user_id,
    message: 'Account linked successfully. You can now use WhatsApp to manage your cart and join group buys.',
  });
}

async function handleBotGetCart(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?user_id=eq.${encodeURIComponent(userId)}&select=id,quantity,product_id,products(id,name,price,image_url,category)`,
    { headers: adminHeaders }
  );
  const items = await resp.json();
  const total = (items || []).reduce((sum: number, i: Record<string, unknown>) => {
    const p = i.products as Record<string, unknown> | null;
    return sum + ((p?.price as number) || 0) * ((i.quantity as number) || 1);
  }, 0);
  return jsonResponse({
    success: true,
    cart: items || [],
    total: Number(total.toFixed(2)),
    item_count: (items || []).length,
  });
}

async function handleBotAddToCart(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);
  const productId = Number(body.productId);
  const quantity = Math.max(1, Number(body.quantity) || 1);
  if (!productId) return errorResponse('productId required', 400);

  // Verify product exists
  const prodResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=id,name,price`, { headers: adminHeaders });
  const products = await prodResp.json();
  if (!products?.length) return errorResponse('Product not found', 404);

  // Upsert into cart_items
  // First check if already in cart
  const existingResp = await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?user_id=eq.${encodeURIComponent(userId)}&product_id=eq.${productId}&select=id,quantity`,
    { headers: adminHeaders }
  );
  const existing = await existingResp.json();
  if (existing?.length > 0) {
    const newQty = (existing[0].quantity || 0) + quantity;
    await fetch(`${SUPABASE_URL}/rest/v1/cart_items?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty }),
    });
    return jsonResponse({ success: true, message: `Updated quantity to ${newQty}`, product: products[0] });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/cart_items`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ user_id: userId, product_id: productId, quantity }),
  });
  return jsonResponse({ success: true, message: `Added ${products[0].name} to cart`, product: products[0] });
}

async function handleBotRemoveFromCart(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);
  const cartItemId = body.cartItemId as string;
  if (!cartItemId) return errorResponse('cartItemId required', 400);
  await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?id=eq.${encodeURIComponent(cartItemId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true });
}

async function handleBotClearCart(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);
  await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true });
}

async function handleBotCheckout(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);

  // Fetch cart
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/cart_items?user_id=eq.${encodeURIComponent(userId)}&select=id,quantity,products(id,name,price)`,
    { headers: adminHeaders }
  );
  const items = await resp.json();
  const total = (items || []).reduce((sum: number, i: Record<string, unknown>) => {
    const p = i.products as Record<string, unknown> | null;
    return sum + ((p?.price as number) || 0) * ((i.quantity as number) || 1);
  }, 0);
  const checkoutUrl = `https://eeshaai-cellex-web.hf.space/Eesha buying folder/checkout.html?from=whatsapp`;
  return jsonResponse({
    success: true,
    item_count: (items || []).length,
    total: Number(total.toFixed(2)),
    checkoutUrl,
    message: items?.length
      ? `You have ${(items as Record<string, unknown>[]).length} item(s) totaling $${total.toFixed(2)}. Complete checkout: ${checkoutUrl}`
      : 'Your cart is empty.',
  });
}

async function handleBotJoinGroupBuy(body: Record<string, unknown>): Promise<Response> {
  const userId = await resolveUserId(body);
  if (!userId) return errorResponse('Phone not linked to any account', 404);
  const groupBuyId = body.groupBuyId as string;
  if (!groupBuyId) return errorResponse('groupBuyId required', 400);

  // Check the group buy is open
  const gbResp = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*&order=created_at.desc&limit=1`,
    { headers: adminHeaders }
  );
  const gbs = await gbResp.json();
  if (!gbs?.length) return errorResponse('Group buy not found', 404);
  const gb = gbs[0];
  if (gb.status !== 'open') return errorResponse(`Group buy is ${gb.status}`, 400);
  if (new Date(gb.expires_at) < new Date()) return errorResponse('Group buy expired', 400);

  // Insert member (UNIQUE dedupes)
  await fetch(`${SUPABASE_URL}/rest/v1/group_buy_members`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ group_buy_id: groupBuyId, user_id: userId }),
  }).catch(() => {});

  // Re-fetch
  const refreshed = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*`,
    { headers: adminHeaders }
  );
  const fresh = (await refreshed.json())?.[0];
  return jsonResponse({
    success: true,
    groupBuy: fresh,
    message: `Joined! ${fresh.current_count}/${fresh.target_count} members. ${fresh.target_count - fresh.current_count} more needed for ${fresh.discount_pct}% off.`,
  });
}

async function handleBotGetProduct(body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId required', 400);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=id,name,price,description,image_url,category,seller_id`,
    { headers: adminHeaders }
  );
  const products = await resp.json();
  if (!products?.length) return errorResponse('Product not found', 404);
  const product = products[0];

  // Get seller name
  let sellerName = 'Seller';
  if (product.seller_id) {
    const sellerResp = await fetch(
      `${SUPABASE_URL}/rest/v1/sellers?id=eq.${encodeURIComponent(product.seller_id)}&select=business_name,farm_name`,
      { headers: adminHeaders }
    );
    const seller = (await sellerResp.json())?.[0];
    sellerName = seller?.business_name || seller?.farm_name || 'Seller';
  }
  return jsonResponse({
    success: true,
    product: { ...product, seller_name: sellerName },
    share_url: `https://eeshaai-cellex-web.hf.space/Eesha buying folder/product.html?id=${productId}`,
  });
}

async function handleBotSearch(body: Record<string, unknown>): Promise<Response> {
  const query = (body.query as string || '').trim();
  if (!query) return errorResponse('query required', 400);
  // Simple ilike search
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?or=(name.ilike.*${encodeURIComponent(query)}*,description.ilike.*${encodeURIComponent(query)}*,category.ilike.*${encodeURIComponent(query)}*)&select=id,name,price,image_url,category&order=created_at.desc&limit=10`,
    { headers: adminHeaders }
  );
  const products = await resp.json();
  return jsonResponse({ success: true, products: products || [], count: (products || []).length });
}

async function handleBotGetActiveGroupBuys(_body: Record<string, unknown>): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?status=eq.open&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*,products(id,name,price,image_url)&order=created_at.desc&limit=10`,
    { headers: adminHeaders }
  );
  const gbs = await resp.json();
  return jsonResponse({ success: true, groupBuys: gbs || [] });
}

async function handleBotGetLiveSessions(_body: Record<string, unknown>): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_live_sessions?status=eq.live&select=id,title,description,viewer_count,started_at,featured_product_id,seller_id&order=started_at.desc&limit=10`,
    { headers: adminHeaders }
  );
  const sessions = await resp.json();
  return jsonResponse({
    success: true,
    sessions: (sessions || []).map((s: Record<string, unknown>) => ({
      ...s,
      watch_url: `https://eeshaai-cellex-web.hf.space/live-watch.html?id=${s.id}`,
    })),
  });
}

async function handleBotGetSellerProducts(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId required', 400);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?seller_id=eq.${encodeURIComponent(sellerId)}&select=id,name,price,image_url,category&order=created_at.desc&limit=20`,
    { headers: adminHeaders }
  );
  const products = await resp.json();
  return jsonResponse({ success: true, products: products || [] });
}

// ---------------------------------------------------------------------------
// Helper: resolve phone → user_id via confirmed user_phone_links rows
// ---------------------------------------------------------------------------
async function resolveUserId(body: Record<string, unknown>): Promise<string | null> {
  const phone = normalizePhone(body.phone as string);
  if (!phone) return null;
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_phone_links?phone=eq.${encodeURIComponent(phone)}&confirmed_at=not.is.null&select=user_id&limit=1`,
    { headers: adminHeaders }
  );
  const rows = await resp.json();
  return rows?.[0]?.user_id || null;
}
