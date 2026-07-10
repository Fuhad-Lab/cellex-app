/// <reference lib="deno.ns" />
// Cellex Wishlist Share Edge Function (Phase 2)
// ------------------------------------------------
// Generate a shareable link for the user's current wishlist. The link
// returns a snapshot of items at share time so it keeps working even after
// the wishlist is edited.
//
// API:
//   op=share           body: { title? }              → { token, url }
//   op=get_shared      body: { token }               → { wishlist, items: [...] }
//   op=my_shares                                      → { shares: [...] }
//   op=revoke          body: { token }               → { success }

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

// Generate a short URL-safe token (16 chars)
function generateToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op || 'get_shared';

    // Public op
    if (op === 'get_shared') return await handleGetShared(body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'share':     return await handleShare(user.id, body);
      case 'my_shares': return await handleMyShares(user.id);
      case 'revoke':    return await handleRevoke(user.id, body);
      default:          return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('wishlist-share error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleShare(userId: string, body: Record<string, unknown>): Promise<Response> {
  // Fetch user's wishlist items
  const wlResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_wishlist?user_id=eq.${encodeURIComponent(userId)}&select=id,product_id,created_at&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const wishlist = await wlResp.json();
  const productIds = (wishlist || []).map((w: Record<string, unknown>) => w.product_id);
  if (productIds.length === 0) {
    return errorResponse('Your wishlist is empty — add products first', 400);
  }

  // Fetch product details
  const productsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.join(',')})&select=id,name,price,image_url,category,seller_id`,
    { headers: adminHeaders }
  );
  const products = await productsResp.json();
  const productMap = new Map((products || []).map((p: Record<string, unknown>) => [p.id, p]));

  // Build items snapshot
  const itemsJson = (wishlist || []).map((w: Record<string, unknown>) => ({
    wishlist_item_id: w.id,
    product: productMap.get(w.product_id) || null,
  })).filter((it: Record<string, unknown>) => it.product !== null);

  // Insert share token
  const token = generateToken();
  const title = (body.title as string) || 'My Cellex Wishlist';
  const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      token,
      user_id: userId,
      title,
      items_json: itemsJson,
    }),
  });
  if (!insertResp.ok) {
    const err = await insertResp.text();
    return errorResponse(`Failed to create share link: ${err}`, 500);
  }

  return jsonResponse({ success: true, token, url: `/shared-wishlist.html?token=${token}` });
}

async function handleGetShared(body: Record<string, unknown>): Promise<Response> {
  const token = body.token as string;
  if (!token) return errorResponse('token is required', 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shared_wishlists?token=eq.${encodeURIComponent(token)}&select=*`,
    { headers: adminHeaders }
  );
  const rows = await resp.json();
  if (!rows || rows.length === 0) return errorResponse('Share link not found or revoked', 404);
  const share = rows[0];

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return errorResponse('This share link has expired', 410);
  }

  // Increment view count (fire-and-forget)
  fetch(`${SUPABASE_URL}/rest/v1/shared_wishlists?token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ view_count: (share.view_count || 0) + 1 }),
  }).catch(() => {});

  return jsonResponse({
    success: true,
    wishlist: {
      title: share.title,
      created_at: share.created_at,
      view_count: (share.view_count || 0) + 1,
    },
    items: share.items_json || [],
  });
}

async function handleMyShares(userId: string): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/shared_wishlists?user_id=eq.${encodeURIComponent(userId)}&select=token,title,view_count,created_at,expires_at&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const shares = await resp.json();
  return jsonResponse({ success: true, shares: shares || [] });
}

async function handleRevoke(userId: string, body: Record<string, unknown>): Promise<Response> {
  const token = body.token as string;
  if (!token) return errorResponse('token is required', 400);

  await fetch(
    `${SUPABASE_URL}/rest/v1/shared_wishlists?token=eq.${encodeURIComponent(token)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  return jsonResponse({ success: true });
}
