/// <reference lib="deno.ns" />
// Cellex Seller Orders Edge Function
// -----------------------------------
// Lists orders that contain items sold by the current seller.
//
// API:
//   op=list    → { orders: [...] }
//   op=details → { order, items: [...] }   body: { orderId }

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
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    const body = await req.json().catch(() => ({}));
    const op = body.op || 'list';

    switch (op) {
      case 'list':    return await handleList(user.id);
      case 'details': return await handleDetails(user.id, body);
      default:        return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('seller-orders error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleList(sellerId: string): Promise<Response> {
  // Get all order items for this seller, joined with the parent order
  const itemsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_order_items?select=id,order_id,product_id,product_name,quantity,price,product_image,created_at&seller_id=eq.${encodeURIComponent(sellerId)}&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const items = await itemsResp.json();

  if (!items || items.length === 0) {
    return jsonResponse({ success: true, orders: [] });
  }

  // Fetch the parent orders
  const orderIds = Array.from(new Set(items.map((i: Record<string, unknown>) => i.order_id)));
  const ordersResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_orders?select=id,order_number,status,total,shipping_address,payment_status,created_at&id=in.(${orderIds.join(',')})&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const orders = await ordersResp.json();

  // Group items under their order
  const grouped = (orders || []).map((o: Record<string, unknown>) => ({
    ...o,
    items: items.filter((i: Record<string, unknown>) => i.order_id === o.id),
  }));

  return jsonResponse({ success: true, orders: grouped });
}

async function handleDetails(sellerId: string, body: Record<string, unknown>): Promise<Response> {
  const orderId = body.orderId as string;
  if (!orderId) return errorResponse('orderId is required', 400);

  const [orderResp, itemsResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/buyers_orders?id=eq.${encodeURIComponent(orderId)}&select=*`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/buyers_order_items?order_id=eq.${encodeURIComponent(orderId)}&seller_id=eq.${encodeURIComponent(sellerId)}&select=*`, { headers: adminHeaders }),
  ]);
  const order = (await orderResp.json())?.[0] || null;
  const items = await itemsResp.json();

  return jsonResponse({ success: true, order, items: items || [] });
}
