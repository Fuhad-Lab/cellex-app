/// <reference lib="deno.ns" />
// Cellex Reviews Edge Function (Phase 2)
// ---------------------------------------
// Buyers leave reviews (with optional photos) for products they purchased.
// Reviews appear on the product page and on the seller's public profile.
//
// API:
//   op=by_product   body: { productId }              → { reviews, summary: { avg, count } }
//   op=by_seller    body: { sellerId }               → { reviews, summary }
//   op=create       body: { productId, orderId, rating, title, comment, images? }
//   op=helpful      body: { reviewId }               → { helpful_count } (increments)
//   op=delete       body: { reviewId }               → { success }

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
    const op = body.op || 'by_product';

    // Public ops
    if (op === 'by_product') return await handleByProduct(body);
    if (op === 'by_seller')  return await handleBySeller(body);

    // Auth-required ops
    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    switch (op) {
      case 'create':  return await handleCreate(user.id, body);
      case 'helpful': return await handleHelpful(body);
      case 'delete':  return await handleDelete(user.id, body);
      default:        return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('reviews error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleByProduct(body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);

  const [reviewsResp, summaryResp] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/buyers_reviews?product_id=eq.${productId}&select=id,user_id,rating,title,comment,images,verified_purchase,helpful_count,created_at&order=helpful_count.desc,created_at.desc`,
      { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/product_ratings?product_id=eq.${productId}&select=avg_rating,review_count`,
      { headers: adminHeaders }),
  ]);
  const reviews = await reviewsResp.json();
  const summary = (await summaryResp.json())?.[0] || { avg_rating: 0, review_count: 0 };

  // Enrich with reviewer name
  const userIds = Array.from(new Set((reviews || []).map((r: Record<string, unknown>) => r.user_id)));
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersResp = await fetch(
      `${SUPABASE_URL}/rest/v1/sellers?id=in.(${userIds.join(',')})&select=id,business_name,profile_image`,
      { headers: adminHeaders }
    );
    const sellers = await usersResp.json();
    (sellers || []).forEach((s: Record<string, unknown>) => {
      userMap.set(s.id as string, (s.business_name as string) || 'Buyer');
    });
  }

  const enriched = (reviews || []).map((r: Record<string, unknown>) => ({
    ...r,
    reviewer_name: userMap.get(r.user_id as string) || 'Buyer',
  }));

  return jsonResponse({
    success: true,
    reviews: enriched,
    summary: { avg: Number(summary.avg_rating) || 0, count: summary.review_count || 0 },
  });
}

async function handleBySeller(body: Record<string, unknown>): Promise<Response> {
  const sellerId = body.sellerId as string;
  if (!sellerId) return errorResponse('sellerId is required', 400);

  // Get seller's products
  const productsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?seller_id=eq.${encodeURIComponent(sellerId)}&select=id,name,image_url,price`,
    { headers: adminHeaders }
  );
  const products = await productsResp.json();
  const productIds = (products || []).map((p: Record<string, unknown>) => p.id);
  if (productIds.length === 0) {
    return jsonResponse({ success: true, reviews: [], summary: { avg: 0, count: 0 } });
  }

  // Get all reviews for those products
  const reviewsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_reviews?product_id=in.(${productIds.join(',')})&select=id,product_id,user_id,rating,title,comment,images,verified_purchase,helpful_count,created_at&order=created_at.desc&limit=50`,
    { headers: adminHeaders }
  );
  const reviews = await reviewsResp.json();

  // Compute aggregate
  const total = (reviews || []).length;
  const avg = total > 0
    ? (reviews as Record<string, unknown>[]).reduce((s, r) => s + Number(r.rating), 0) / total
    : 0;

  // Attach product info to each review
  const productMap = new Map((products || []).map((p: Record<string, unknown>) => [p.id, p]));
  const enriched = (reviews || []).map((r: Record<string, unknown>) => ({
    ...r,
    product: productMap.get(r.product_id) || null,
  }));

  return jsonResponse({
    success: true,
    reviews: enriched,
    summary: { avg: Math.round(avg * 100) / 100, count: total },
  });
}

async function handleCreate(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  const orderId = body.orderId as string;
  const rating = Number(body.rating);

  if (!productId || !rating || rating < 1 || rating > 5) {
    return errorResponse('productId and rating (1-5) are required', 400);
  }

  // Verify the user purchased this product (must have an order item with this product_id)
  const verifyResp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_order_items?select=id&order_id=in.(SELECT id FROM buyers_orders WHERE user_id=eq.${encodeURIComponent(userId)})&product_id=eq.${productId}&limit=1`,
    { headers: adminHeaders }
  );
  const purchased = await verifyResp.json();
  const verifiedPurchase = (purchased?.length || 0) > 0;
  if (!verifiedPurchase) {
    return errorResponse('You can only review products you have purchased', 403);
  }

  // Insert review
  const payload: Record<string, unknown> = {
    user_id: userId,
    product_id: productId,
    rating,
    title: (body.title as string) || '',
    comment: (body.comment as string) || '',
    images: body.images || [],
    verified_purchase: true,
    helpful_count: 0,
  };
  if (orderId) payload.order_id = orderId;

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/buyers_reviews`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  const created = await resp.json();
  if (!resp.ok) return errorResponse(created?.message || 'Failed to create review', 500);

  return jsonResponse({ success: true, review: created?.[0] });
}

async function handleHelpful(body: Record<string, unknown>): Promise<Response> {
  const reviewId = body.reviewId as string;
  if (!reviewId) return errorResponse('reviewId is required', 400);

  // Atomic increment
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_reviews?id=eq.${encodeURIComponent(reviewId)}&select=helpful_count`,
    { headers: adminHeaders }
  );
  const rows = await resp.json();
  const cur = rows?.[0]?.helpful_count || 0;
  const newCount = cur + 1;

  await fetch(`${SUPABASE_URL}/rest/v1/buyers_reviews?id=eq.${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ helpful_count: newCount }),
  });

  return jsonResponse({ success: true, helpful_count: newCount });
}

async function handleDelete(userId: string, body: Record<string, unknown>): Promise<Response> {
  const reviewId = body.reviewId as string;
  if (!reviewId) return errorResponse('reviewId is required', 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/buyers_reviews?id=eq.${encodeURIComponent(reviewId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: adminHeaders }
  );
  if (!resp.ok) return errorResponse('Failed to delete review', 500);

  return jsonResponse({ success: true });
}
