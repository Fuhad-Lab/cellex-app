/// <reference lib="deno.ns" />
// Cellex Profile Edge Function
// Get/update user profile and stats
//
// API:
//   op=get    → get profile + stats (orders count, wishlist count, reviews count)
//   op=update → { "fullName": "...", "phone": "...", "address": "..." } update profile

import { corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect, supabaseUpdate } from '../_shared/cors.ts';

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
      case 'update':
        return await handleUpdate(user.id, body);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Profile edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleGet(userId: string): Promise<Response> {
  // Get profile
  const profileUrl = `${SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`;
  const profileResp = await fetch(profileUrl, { headers: restHeaders });
  const profileData = await profileResp.json();
  const profile = profileData?.[0] || null;

  // Get stats in parallel
  const [ordersResp, wishlistResp, reviewsResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/buyers_orders?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers: restHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/buyers_wishlist?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers: restHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/buyers_reviews?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers: restHeaders }),
  ]);

  const orders = await ordersResp.json();
  const wishlist = await wishlistResp.json();
  const reviews = await reviewsResp.json();

  // Get total spent
  const spentResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_orders?select=total&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: restHeaders }
  );
  const spentData = await spentResp.json();
  const totalSpent = (spentData || []).reduce((sum: number, o: Record<string, unknown>) => sum + ((o.total as number) || 0), 0);

  return jsonResponse({
    success: true,
    profile: profile || { id: userId, full_name: '', phone: '', address: '' },
    stats: {
      ordersCount: orders?.length || 0,
      wishlistCount: wishlist?.length || 0,
      reviewsCount: reviews?.length || 0,
      totalSpent,
    }
  });
}

async function handleUpdate(userId: string, body: Record<string, unknown>): Promise<Response> {
  const updates: Record<string, unknown> = {};
  if (body.fullName !== undefined) updates.full_name = body.fullName;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.address !== undefined) updates.address = body.address;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length === 0) {
    return errorResponse('No fields to update', 400);
  }

  const updated = await supabaseUpdate('profiles', updates, { id: `eq.${userId}` });

  if (!updated) return errorResponse('Failed to update profile', 500);

  return jsonResponse({ success: true, profile: updated[0] });
}
