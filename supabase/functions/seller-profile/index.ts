/// <reference lib="deno.ns" />
// Cellex Seller Profile Edge Function
// ------------------------------------
// Get / update the authenticated seller's own profile.
//
// API:
//   op=get    → { seller: {...} }
//   op=update → { seller: {...} }  body: { business_name?, business_description?, ... }

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
  supabaseSelect, supabaseUpdate,
} from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    const body = await req.json().catch(() => ({}));
    const op = body.op || 'get';

    switch (op) {
      case 'get':    return await handleGet(user.id);
      case 'update': return await handleUpdate(user.id, body);
      default:       return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('seller-profile error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleGet(sellerId: string): Promise<Response> {
  const rows = await supabaseSelect('sellers', '*', { id: `eq.${sellerId}` });
  const seller = rows?.[0] || null;
  return jsonResponse({ success: true, seller });
}

async function handleUpdate(sellerId: string, body: Record<string, unknown>): Promise<Response> {
  const allowed = [
    'business_name', 'business_description', 'business_category',
    'business_location', 'profile_image', 'phone', 'contact_phone',
    'address', 'state', 'farm_name', 'farm_type', 'seller_type',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 1) {
    return errorResponse('No fields to update', 400);
  }

  const updated = await supabaseUpdate('sellers', updates, { id: `eq.${sellerId}` });
  if (!updated) return errorResponse('Failed to update seller profile', 500);

  return jsonResponse({ success: true, seller: updated[0] });
}
