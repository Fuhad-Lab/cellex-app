/// <reference lib="deno.ns" />
// Cellex Wishlist Edge Function
// Get/add/remove wishlist items
//
// API:
//   op=get     → get all wishlist items with product details
//   op=add     → { "productId": "..." } add to wishlist
//   op=remove  → { "wishlistItemId": "..." } remove from wishlist

import { corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect, supabaseInsert, supabaseDelete } from '../_shared/cors.ts';

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
      case 'get':
        return await handleGet(user.id);
      case 'add':
        return await handleAdd(user.id, body);
      case 'remove':
        return await handleRemove(user.id, body);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Wishlist edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleGet(userId: string): Promise<Response> {
  const url = `${SUPABASE_URL}/rest/v1/buyers_wishlist?select=id,product_id,created_at,products(id,name,price,image_url,category)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
  const resp = await fetch(url, { headers: restHeaders });
  const items = await resp.json();

  return jsonResponse({ success: true, items: items || [] });
}

async function handleAdd(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = body.productId as string;
  if (!productId) return errorResponse('Missing productId', 400);

  // Check if already in wishlist
  const existing = await supabaseSelect(
    'buyers_wishlist',
    'id',
    { user_id: `eq.${userId}`, product_id: `eq.${productId}` }
  );

  if (existing && existing.length > 0) {
    return jsonResponse({ success: true, message: 'Already in wishlist', item: existing[0] });
  }

  const inserted = await supabaseInsert('buyers_wishlist', {
    user_id: userId,
    product_id: productId,
  });

  if (!inserted) return errorResponse('Failed to add to wishlist', 500);

  return jsonResponse({ success: true, message: 'Added to wishlist', item: inserted });
}

async function handleRemove(userId: string, body: Record<string, unknown>): Promise<Response> {
  const wishlistItemId = body.wishlistItemId as string;
  if (!wishlistItemId) return errorResponse('Missing wishlistItemId', 400);

  const success = await supabaseDelete('buyers_wishlist', {
    id: `eq.${wishlistItemId}`,
    user_id: `eq.${userId}`,
  });

  if (!success) return errorResponse('Failed to remove from wishlist', 500);

  return jsonResponse({ success: true, message: 'Removed from wishlist' });
}
