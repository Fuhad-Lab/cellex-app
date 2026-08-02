/// <reference lib="deno.ns" />
// Cellex Profile Edge Function — FIXED to use UPSERT and support profileImage.
//
// API:
//   op=get    → get profile + stats (orders count, wishlist count, reviews count)
//   op=update → { fullName?, phone?, address?, profileImage? } upsert profile
//
// BUG FIXED: The previous version used UPDATE, which fails for new users
// who don't have a row in `profiles` yet. Now we use UPSERT (POST with
// Prefer: resolution=merge-duplicates) so it works for both new and
// existing users.
//
// BUG FIXED: The frontend sends `profileImage` but the old function only
// accepted `avatar_url`. Now we accept both, mapping to the `avatar_url`
// column in the profiles table.

import {
  corsHeaders, jsonResponse, errorResponse, getUser, supabaseRest,
} from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const { op } = body;

    switch (op) {
      case 'get':    return await handleGet(user.id);
      case 'update': return await handleUpdate(user.id, body);
      default:       return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Profile edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleGet(userId: string) {
  const { url, headers } = supabaseRest();

  // Get profile row
  const profileResp = await fetch(
    `${url}/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers }
  );
  const profileData = await profileResp.json();
  const profile = profileData?.[0] || null;

  // Get stats in parallel
  const [ordersResp, wishlistResp, reviewsResp, spentResp] = await Promise.all([
    fetch(`${url}/rest/v1/buyers_orders?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers }),
    fetch(`${url}/rest/v1/buyers_wishlist?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers }),
    fetch(`${url}/rest/v1/buyers_reviews?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers }),
    fetch(`${url}/rest/v1/buyers_orders?select=total&user_id=eq.${encodeURIComponent(userId)}`, { headers }),
  ]);

  const orders = await ordersResp.json();
  const wishlist = await wishlistResp.json();
  const reviews = await reviewsResp.json();
  const spentData = await spentResp.json();
  const totalSpent = (spentData || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  return jsonResponse({
    success: true,
    profile: profile || {
      id: userId,
      full_name: '',
      phone: '',
      address: '',
      avatar_url: '',
    },
    stats: {
      ordersCount: orders?.length || 0,
      wishlistCount: wishlist?.length || 0,
      reviewsCount: reviews?.length || 0,
      totalSpent,
    },
  });
}

async function handleUpdate(userId: string, body: any) {
  const { url, headers } = supabaseRest();

  // Build the update payload.
  // The frontend sends camelCase fields; we map them to snake_case columns.
  // We include `id` so the UPSERT knows which row to merge into.
  const payload: Record<string, unknown> = { id: userId };

  if (body.fullName !== undefined)     payload.full_name  = String(body.fullName).slice(0, 200);
  if (body.phone !== undefined)        payload.phone      = String(body.phone).slice(0, 50);
  if (body.address !== undefined)      payload.address    = String(body.address).slice(0, 500);
  if (body.profileImage !== undefined) payload.avatar_url = String(body.profileImage).slice(0, 1000);
  if (body.avatar_url !== undefined)   payload.avatar_url = String(body.avatar_url).slice(0, 1000);

  if (Object.keys(payload).length <= 1) {
    return errorResponse('No fields to update', 400);
  }

  // UPSERT: insert the row if it doesn't exist, otherwise merge into it.
  // This is the fix — UPDATE alone fails for new users with no profile row.
  const resp = await fetch(`${url}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Profile upsert error: ${resp.status} ${errText}`);
    return errorResponse(`Failed to update profile: ${errText.slice(0, 200)}`, 500);
  }

  const result = await resp.json();
  const updated = Array.isArray(result) ? result[0] : result;
  return jsonResponse({ success: true, profile: updated });
}
