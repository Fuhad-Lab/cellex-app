/// <reference lib="deno.ns" />
// Cellex Group Buy Edge Function (Phase 2 — Pinduoduo model)
// -----------------------------------------------------------
// A buyer initiates a group buy for a product. They share a link. Friends join.
// When target_count is reached, the group is "completed" and the discount is
// applied automatically at checkout.
//
// API:
//   op=create   body: { productId, targetCount?, discountPct? }   → { groupBuy }
//   op=join     body: { groupBuyId }                              → { groupBuy, joined: true }
//   op=status   body: { groupBuyId }                              → { groupBuy, members: [...] }
//   op=active   body: { productId }                               → { groupBuys: [...] } (open groups for this product)
//   op=mine                                      → { groupBuys: [...] } (groups I started or joined)
//   op=cancel   body: { groupBuyId }                              → { success } (initiator only)

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
    const op = body.op || 'active';

    // Public ops
    if (op === 'status') return await handleStatus(body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'create': return await handleCreate(user.id, body);
      case 'join':   return await handleJoin(user.id, body);
      case 'active': return await handleActive(body);
      case 'mine':   return await handleMine(user.id);
      case 'cancel': return await handleCancel(user.id, body);
      default:       return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('group-buy error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleCreate(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);
  const targetCount = Math.min(Math.max(Number(body.targetCount) || 3, 2), 50);
  const discountPct = Math.min(Math.max(Number(body.discountPct) || 20, 1), 90);

  // Look up the product to get seller_id and check it exists
  const prodResp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=id,seller_id,name,price`,
    { headers: adminHeaders }
  );
  const products = await prodResp.json();
  if (!products || products.length === 0) return errorResponse('Product not found', 404);
  const product = products[0];

  // Create group buy
  const createResp = await fetch(`${SUPABASE_URL}/rest/v1/group_buys`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      product_id: productId,
      seller_id: product.seller_id,
      initiator_id: userId,
      target_count: targetCount,
      current_count: 1,
      discount_pct: discountPct,
      status: 'open',
    }),
  });
  const created = await createResp.json();
  if (!createResp.ok) return errorResponse('Failed to create group buy', 500);
  const groupBuyId = created[0].id;

  // Add initiator as first member
  await fetch(`${SUPABASE_URL}/rest/v1/group_buy_members`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      group_buy_id: groupBuyId,
      user_id: userId,
    }),
  });

  // Re-fetch the group buy (current_count may have been updated by trigger)
  const refreshed = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*`,
    { headers: adminHeaders }
  );
  const freshRows = await refreshed.json();

  return jsonResponse({ success: true, groupBuy: freshRows?.[0] || created[0], product });
}

async function handleJoin(userId: string, body: Record<string, unknown>): Promise<Response> {
  const groupBuyId = body.groupBuyId as string;
  if (!groupBuyId) return errorResponse('groupBuyId is required', 400);

  // Check the group buy is still open and not expired
  const gbResp = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*`,
    { headers: adminHeaders }
  );
  const gbs = await gbResp.json();
  if (!gbs || gbs.length === 0) return errorResponse('Group buy not found', 404);
  const gb = gbs[0];
  if (gb.status !== 'open') return errorResponse(`Group buy is ${gb.status}`, 400);
  if (new Date(gb.expires_at) < new Date()) return errorResponse('Group buy has expired', 400);

  // Insert member (UNIQUE constraint handles duplicates — return success either way)
  const insResp = await fetch(`${SUPABASE_URL}/rest/v1/group_buy_members`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      group_buy_id: groupBuyId,
      user_id: userId,
    }),
  });
  // 409 = duplicate, that's fine
  const alreadyMember = insResp.status === 409;

  // Re-fetch the updated group buy
  const refreshed = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*`,
    { headers: adminHeaders }
  );
  const fresh = (await refreshed.json())?.[0];

  return jsonResponse({ success: true, groupBuy: fresh, alreadyMember });
}

async function handleStatus(body: Record<string, unknown>): Promise<Response> {
  const groupBuyId = body.groupBuyId as string;
  if (!groupBuyId) return errorResponse('groupBuyId is required', 400);

  const [gbResp, membersResp, productResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=*`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/group_buy_members?group_buy_id=eq.${encodeURIComponent(groupBuyId)}&select=user_id,joined_at&order=joined_at.asc`, { headers: adminHeaders }),
  ]).then(async ([a, b]) => {
    const gb = await a.json();
    const members = await b.json();
    // Need product info
    if (gb?.[0]?.product_id) {
      const pid = gb[0].product_id;
      const pResp = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${pid}&select=id,name,price,image_url,seller_id`, { headers: adminHeaders });
      const p = await pResp.json();
      return [gb, members, p?.[0] || null];
    }
    return [gb, members, null];
  });

  return jsonResponse({
    success: true,
    groupBuy: gbResp?.[0] || null,
    members: membersResp || [],
    product: productResp,
  });
}

async function handleActive(body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?product_id=eq.${productId}&status=eq.open&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=10`,
    { headers: adminHeaders }
  );
  const gbs = await resp.json();
  return jsonResponse({ success: true, groupBuys: gbs || [] });
}

async function handleMine(userId: string): Promise<Response> {
  // Groups I started OR joined
  const [initResp, memberResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/group_buys?initiator_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/group_buy_members?user_id=eq.${encodeURIComponent(userId)}&select=group_buy_id`, { headers: adminHeaders }),
  ]);
  const initiated = await initResp.json();
  const memberships = await memberResp.json();

  // Fetch group buy details for memberships
  const gbIds = (memberships || []).map((m: Record<string, unknown>) => m.group_buy_id);
  let joined: Record<string, unknown>[] = [];
  if (gbIds.length > 0) {
    const joinedResp = await fetch(
      `${SUPABASE_URL}/rest/v1/group_buys?id=in.(${gbIds.join(',')})&select=*&order=created_at.desc`,
      { headers: adminHeaders }
    );
    joined = await joinedResp.json();
  }

  // Merge and dedupe
  const allMap = new Map<string, Record<string, unknown>>();
  [...(initiated || []), ...joined].forEach((gb: Record<string, unknown>) => {
    allMap.set(gb.id as string, gb);
  });

  return jsonResponse({ success: true, groupBuys: Array.from(allMap.values()) });
}

async function handleCancel(userId: string, body: Record<string, unknown>): Promise<Response> {
  const groupBuyId = body.groupBuyId as string;
  if (!groupBuyId) return errorResponse('groupBuyId is required', 400);

  // Only initiator can cancel
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}&initiator_id=eq.${encodeURIComponent(userId)}&select=id`,
    { headers: adminHeaders }
  );
  const rows = await resp.json();
  if (!rows || rows.length === 0) return errorResponse('Not authorized to cancel this group buy', 403);

  await fetch(
    `${SUPABASE_URL}/rest/v1/group_buys?id=eq.${encodeURIComponent(groupBuyId)}`,
    { method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }
  );

  return jsonResponse({ success: true });
}
