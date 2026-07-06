/// <reference lib="deno.ns" />
// Cellex Orders Edge Function
// Get user's order history and individual order details
//
// API:
//   op=list          → get all orders for the user
//   op=details       → { "orderId": "..." } get single order with items

import { corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const restHeaders = {
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

    const body = await req.json();
    const { op } = body;

    switch (op) {
      case 'list':
        return await handleList(user.id);
      case 'details':
        return await handleDetails(user.id, body);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Orders edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleList(userId: string): Promise<Response> {
  const orders = await supabaseSelect(
    'buyers_orders',
    'id, order_id, total, status, created_at, items',
    { user_id: `eq.${userId}` },
    { order: 'created_at', ascending: false, limit: 50 }
  );

  return jsonResponse({ success: true, orders: orders || [] });
}

async function handleDetails(userId: string, body: Record<string, unknown>): Promise<Response> {
  const orderId = body.orderId as string;
  if (!orderId) return errorResponse('Missing orderId', 400);

  const url = `${SUPABASE_URL}/rest/v1/buyers_orders?select=*&order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const resp = await fetch(url, { headers: restHeaders });
  const data = await resp.json();

  if (!data || data.length === 0) {
    return errorResponse('Order not found', 404);
  }

  return jsonResponse({ success: true, order: data[0] });
}
