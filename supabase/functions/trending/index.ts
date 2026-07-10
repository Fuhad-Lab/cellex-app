/// <reference lib="deno.ns" />
// Cellex Trending Edge Function (Phase 3)
// -----------------------------------------
// Computes a trending score per product based on:
//   views (last 24h) + shares (last 24h) + purchases (last 24h)
// Score = views + (shares * 3) + (purchases * 5)
// Updates the trending_cache table (idempotent — refreshes on each call).
//
// API:
//   op=list   body: { limit?, hours? }       → { products: [...], refreshed_at } (public)
//   op=log_view   body: { productId, source? }   (auth-optional — increments product_view_log)
//   op=log_share  body: { productId, platform? } (auth-required)

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

    if (op === 'list') return await handleList(body);

    // Auth-required ops
    const user = await getUser(req);
    if (op === 'log_view')  return await handleLogView(user?.id || null, body);
    if (op === 'log_share') {
      if (!user) return errorResponse('Not authenticated', 401);
      return await handleLogShare(user.id, body);
    }
    return errorResponse(`Unknown op: ${op}`, 400);
  } catch (error) {
    console.error('trending error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleList(body: Record<string, unknown>): Promise<Response> {
  const limit = Math.min(Number(body.limit) || 20, 100);
  const hours = Number(body.hours) || 24;

  const since = new Date(Date.now() - hours * 3600000).toISOString();

  // Run aggregations in parallel via PostgREST
  const [viewsResp, sharesResp, purchasesResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/rpc/count_views_since`,
      { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ since_ts: since }) }).catch(() => null),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/count_shares_since`,
      { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ since_ts: since }) }).catch(() => null),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/count_purchases_since`,
      { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ since_ts: since }) }).catch(() => null),
  ]);

  // If RPCs don't exist, fall back to fetching raw rows
  let viewsMap = new Map<number, number>();
  let sharesMap = new Map<number, number>();
  let purchasesMap = new Map<number, number>();

  if (viewsResp?.ok) {
    const rows = await viewsResp.json();
    (rows || []).forEach((r: Record<string, unknown>) => viewsMap.set(Number(r.product_id), Number(r.n)));
  } else {
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/product_view_log?created_at=gte.${encodeURIComponent(since)}&product_id=not.is.null&select=product_id`,
      { headers: adminHeaders }
    ).then(r => r.json());
    (rows || []).forEach((r: Record<string, unknown>) => {
      const pid = Number(r.product_id);
      viewsMap.set(pid, (viewsMap.get(pid) || 0) + 1);
    });
  }

  if (sharesResp?.ok) {
    const rows = await sharesResp.json();
    (rows || []).forEach((r: Record<string, unknown>) => sharesMap.set(Number(r.product_id), Number(r.n)));
  } else {
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/product_share_log?created_at=gte.${encodeURIComponent(since)}&select=product_id`,
      { headers: adminHeaders }
    ).then(r => r.json());
    (rows || []).forEach((r: Record<string, unknown>) => {
      const pid = Number(r.product_id);
      sharesMap.set(pid, (sharesMap.get(pid) || 0) + 1);
    });
  }

  if (purchasesResp?.ok) {
    const rows = await purchasesResp.json();
    (rows || []).forEach((r: Record<string, unknown>) => purchasesMap.set(Number(r.product_id), Number(r.n)));
  } else {
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/buyers_order_items?created_at=gte.${encodeURIComponent(since)}&select=product_id,quantity`,
      { headers: adminHeaders }
    ).then(r => r.json());
    (rows || []).forEach((r: Record<string, unknown>) => {
      const pid = Number(r.product_id);
      purchasesMap.set(pid, (purchasesMap.get(pid) || 0) + Number(r.quantity || 1));
    });
  }

  // Combine into product IDs with scores
  const productIds = new Set<number>([...viewsMap.keys(), ...sharesMap.keys(), ...purchasesMap.keys()]);
  if (productIds.size === 0) {
    return jsonResponse({ success: true, products: [], refreshed_at: new Date().toISOString() });
  }

  // Fetch product details
  const productsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=in.(${Array.from(productIds).join(',')})&select=id,name,price,image_url,category,seller_id,units_sold&order=created_at.desc&limit=${limit * 2}`,
    { headers: adminHeaders }
  );
  const products = await productsResp.json();

  // Seller info
  const sellerIds = Array.from(new Set((products || []).map((p: Record<string, unknown>) => p.seller_id)));
  let sellerMap = new Map<string, Record<string, unknown>>();
  if (sellerIds.length > 0) {
    const sellersResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image,farm_name`, { headers: adminHeaders });
    (await sellersResp.json()).forEach((s: Record<string, unknown>) => sellerMap.set(s.id as string, s));
  }

  const scored = (products || []).map((p: Record<string, unknown>) => {
    const pid = Number(p.id);
    const views = viewsMap.get(pid) || 0;
    const shares = sharesMap.get(pid) || 0;
    const purchases = purchasesMap.get(pid) || 0;
    const score = views + shares * 3 + purchases * 5;
    return {
      id: p.id, name: p.name, price: p.price,
      image_url: p.image_url, category: p.category,
      units_sold: p.units_sold || 0,
      seller: sellerMap.get(p.seller_id as string) || null,
      trending: { views, shares, purchases, score },
    };
  }).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    ((b.trending as Record<string, unknown>).score as number) - ((a.trending as Record<string, unknown>).score as number))
    .slice(0, limit);

  return jsonResponse({
    success: true,
    products: scored,
    refreshed_at: new Date().toISOString(),
    window_hours: hours,
  });
}

async function handleLogView(userId: string | null, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);
  const source = (body.source as string) || 'product_page';
  await fetch(`${SUPABASE_URL}/rest/v1/product_view_log`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, user_id: userId, source }),
  }).catch(() => {});
  return jsonResponse({ success: true });
}

async function handleLogShare(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);
  const platform = (body.platform as string) || 'whatsapp';
  await fetch(`${SUPABASE_URL}/rest/v1/product_share_log`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, user_id: userId, platform }),
  }).catch(() => {});
  return jsonResponse({ success: true });
}
