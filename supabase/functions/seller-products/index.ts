/// <reference lib="deno.ns" />
// Cellex Seller Products Edge Function
// -------------------------------------
// CRUD for the seller's own product catalog.
//
// API:
//   op=list         → { products: [...] }
//   op=create       → { product: {...} }    body: { name, price, description, image_url, category, additional_images? }
//   op=update       → { product: {...} }    body: { id, ...fields }
//   op=delete       → { success: true }     body: { id }

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
      case 'list':   return await handleList(user.id);
      case 'create': return await handleCreate(user.id, body);
      case 'update': return await handleUpdate(user.id, body);
      case 'delete': return await handleDelete(user.id, body);
      default:       return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('seller-products error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleList(sellerId: string): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=*&seller_id=eq.${encodeURIComponent(sellerId)}&order=created_at.desc`,
    { headers: adminHeaders }
  );
  const products = await resp.json();
  return jsonResponse({ success: true, products: products || [] });
}

async function handleCreate(sellerId: string, body: Record<string, unknown>): Promise<Response> {
  const name = (body.name as string)?.trim();
  const price = Number(body.price);
  if (!name || !price || price <= 0) {
    return errorResponse('name and a positive price are required', 400);
  }

  const payload: Record<string, unknown> = {
    seller_id: sellerId,
    name,
    price,
    description: (body.description as string) || '',
    image_url: (body.image_url as string) || '',
    category: (body.category as string) || 'General',
    additional_images: body.additional_images || [],
    total_sales: 0,
    units_sold: 0,
    created_at: new Date().toISOString(),
  };

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  const created = await resp.json();
  if (!resp.ok) return errorResponse(created?.message || 'Failed to create product', 500);
  const product = created?.[0];

  // Phase 4: Auto-broadcast to Telegram (fire-and-forget)
  broadcastToTelegram('new_product', String(product.id),
    `🆕 <b>New product:</b> ${escapeHtml(name)}\n💵 $${Number(price).toFixed(2)}\n📦 ${payload.category}\n\n${SUPABASE_URL ? 'https://eeshaai-cellex-web.hf.space/Eesha buying folder/product.html?id=' + product.id : ''}`,
    payload.image_url as string | undefined
  ).catch(() => {});

  return jsonResponse({ success: true, product });
}

// Helper: broadcast to Telegram via the telegram edge function (fire-and-forget)
async function broadcastToTelegram(broadcastType: string, entityId: string, message: string, imageUrl?: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/telegram`, {
    method: 'POST',
    headers: { ...adminHeaders, 'X-Internal-Call': 'cellex-internal', 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'broadcast', broadcastType, entityId, message, imageUrl }),
  }).catch(() => {});
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function handleUpdate(sellerId: string, body: Record<string, unknown>): Promise<Response> {
  const id = Number(body.id);
  if (!id) return errorResponse('id is required', 400);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['name','price','description','image_url','category','additional_images']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${id}&seller_id=eq.${encodeURIComponent(sellerId)}`,
    {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify(updates),
    }
  );
  const updated = await resp.json();
  if (!resp.ok) return errorResponse('Failed to update product', 500);

  return jsonResponse({ success: true, product: updated?.[0] });
}

async function handleDelete(sellerId: string, body: Record<string, unknown>): Promise<Response> {
  const id = Number(body.id);
  if (!id) return errorResponse('id is required', 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${id}&seller_id=eq.${encodeURIComponent(sellerId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  if (!resp.ok) return errorResponse('Failed to delete product', 500);

  return jsonResponse({ success: true });
}
