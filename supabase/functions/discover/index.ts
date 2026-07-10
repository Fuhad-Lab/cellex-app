/// <reference lib="deno.ns" />
// Cellex AI-Powered Discovery Edge Function (Phase 3)
// -----------------------------------------------------
// Recommends products based on:
//   - Past purchases (most recent 30 days)
//   - Cart contents
//   - Wishlist items
//   - Followed sellers
//   - Recently viewed products
//   - Categories the user engages with most
//
// Uses the existing Qwen2.5-72B model via HF Router to generate a personalized
// "why we picked this" explanation for each recommendation.
//
// API:
//   op=recommend   body: { limit? }    → { recommendations: [{ product, reason }], signals }
//   op=log_view    body: { productId }  → { success } (auth-required — used to track engagement)
//
// Fallback: if the AI call fails or times out, we still return rule-based recommendations.

import {
  corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect,
} from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HF_ROUTER_URL = Deno.env.get('HF_ROUTER_URL') || 'https://router.huggingface.co/v1/chat/completions';
const HF_INFERENCE_MODEL = Deno.env.get('HF_INFERENCE_MODEL') || 'Qwen/Qwen2.5-72B-Instruct';
const HF_TOKEN = Deno.env.get('HF_TOKEN') || '';

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
    const op = body.op || 'recommend';

    const user = await getUser(req);
    if (!user) return errorResponse('Not authenticated', 401);

    if (op === 'recommend')  return await handleRecommend(user.id, body);
    if (op === 'log_view')   return await handleLogView(user.id, body);
    return errorResponse(`Unknown op: ${op}`, 400);
  } catch (error) {
    console.error('discover error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleRecommend(userId: string, body: Record<string, unknown>): Promise<Response> {
  const limit = Math.min(Number(body.limit) || 10, 30);

  // Gather user signals in parallel
  const [
    ordersResp, cartResp, wishlistResp, followsResp, viewLogResp
  ] = await Promise.all([
    // Past orders (with items joined)
    fetch(`${SUPABASE_URL}/rest/v1/buyers_orders?user_id=eq.${encodeURIComponent(userId)}&select=id,created_at&order=created_at.desc&limit=20`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/cart_items?user_id=eq.${encodeURIComponent(userId)}&select=product_id,quantity,products(id,name,price,image_url,category,seller_id)`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/buyers_wishlist?user_id=eq.${encodeURIComponent(userId)}&select=product_id,products(id,name,price,image_url,category,seller_id)`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/seller_follows?follower_id=eq.${encodeURIComponent(userId)}&select=seller_id`, { headers: adminHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/product_view_log?user_id=eq.${encodeURIComponent(userId)}&product_id=not.is.null&select=product_id,created_at&order=created_at.desc&limit=20`, { headers: adminHeaders }),
  ]);

  const orders = await ordersResp.json();
  const cart = await cartResp.json();
  const wishlist = await wishlistResp.json();
  const follows = await followsResp.json();
  const viewLog = await viewLogResp.json();

  // Build signals summary
  const followedSellerIds = new Set((follows || []).map((f: Record<string, unknown>) => f.seller_id as string));
  const cartProductIds = new Set((cart || []).map((c: Record<string, unknown>) => c.product_id as number));
  const wishlistProductIds = new Set((wishlist || []).map((w: Record<string, unknown>) => w.product_id as number));
  const recentViewedIds = new Set((viewLog || []).map((v: Record<string, unknown>) => v.product_id as number));

  // Fetch order item product IDs to know what was purchased
  const orderIds = (orders || []).map((o: Record<string, unknown>) => o.id);
  let purchasedProductIds = new Set<number>();
  let purchasedCategoryCounts: Record<string, number> = {};
  if (orderIds.length > 0) {
    const itemsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/buyers_order_items?order_id=in.(${orderIds.join(',')})&select=product_id,quantity`,
      { headers: adminHeaders }
    );
    const items = await itemsResp.json();
    const productIdsFromItems = (items || []).map((i: Record<string, unknown>) => i.product_id as number);
    purchasedProductIds = new Set(productIdsFromItems);

    // Fetch the products to get categories
    if (productIdsFromItems.length > 0) {
      const prodResp = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=in.(${productIdsFromItems.join(',')})&select=id,category`,
        { headers: adminHeaders }
      );
      const prods = await prodResp.json();
      (prods || []).forEach((p: Record<string, unknown>) => {
        const c = (p.category as string) || 'General';
        purchasedCategoryCounts[c] = (purchasedCategoryCounts[c] || 0) + 1;
      });
    }
  }

  // Top categories from cart + wishlist
  const candidateCategories = new Set<string>();
  [...(cart || []), ...(wishlist || [])].forEach((item: Record<string, unknown>) => {
    const product = item.products as Record<string, unknown> | undefined;
    if (product?.category) candidateCategories.add(product.category as string);
  });
  Object.keys(purchasedCategoryCounts).forEach(c => candidateCategories.add(c));

  // Fetch candidate products to recommend
  // Strategy:
  //   1. Products from followed sellers (not yet purchased)
  //   2. Products in user's favorite categories (not yet purchased, not in cart)
  //   3. Fall back to recently-added products
  const excludeIds = new Set<number>([...purchasedProductIds, ...cartProductIds]);

  const candidates: Record<string, unknown>[] = [];

  // 1. Followed sellers' products
  if (followedSellerIds.size > 0) {
    const sellerIdsArr = Array.from(followedSellerIds);
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?seller_id=in.(${sellerIdsArr.join(',')})&select=id,name,price,image_url,category,seller_id,units_sold,created_at&order=created_at.desc&limit=30`,
      { headers: adminHeaders }
    );
    const rows = await resp.json();
    (rows || []).forEach((p: Record<string, unknown>) => {
      if (!excludeIds.has(p.id as number)) candidates.push({ ...p, _signal: 'followed_seller' });
    });
  }

  // 2. Same-category products
  if (candidateCategories.size > 0 && candidates.length < limit * 3) {
    const catList = Array.from(candidateCategories).map(c => `"${c}"`).join(',');
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?category=in.(${encodeURIComponent(Array.from(candidateCategories).join(',')).replace(/%2C/g, ',')})&select=id,name,price,image_url,category,seller_id,units_sold,created_at&order=created_at.desc&limit=30`,
      { headers: adminHeaders }
    );
    const rows = await resp.json();
    (rows || []).forEach((p: Record<string, unknown>) => {
      if (!excludeIds.has(p.id as number) && !candidates.find(c => c.id === p.id)) {
        candidates.push({ ...p, _signal: 'similar_category' });
      }
    });
  }

  // 3. Trending fallback (recently-added products with sales)
  if (candidates.length < limit * 2) {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,price,image_url,category,seller_id,units_sold,created_at&order=units_sold.desc,created_at.desc&limit=20`,
      { headers: adminHeaders }
    );
    const rows = await resp.json();
    (rows || []).forEach((p: Record<string, unknown>) => {
      if (!excludeIds.has(p.id as number) && !candidates.find(c => c.id === p.id)) {
        candidates.push({ ...p, _signal: 'trending' });
      }
    });
  }

  // Score and rank candidates
  const scored = candidates.map(p => {
    let score = 1;
    if (p._signal === 'followed_seller') score += 3;
    if (p._signal === 'similar_category') score += 2;
    if (p._signal === 'trending') score += 1;
    if (wishlistProductIds.has(p.id as number)) score += 1.5;
    if (recentViewedIds.has(p.id as number)) score += 0.5;
    // Boost popular products
    score += Math.min(Number(p.units_sold || 0) / 10, 2);
    return { ...p, _score: score };
  }).sort((a, b) => (b._score as number) - (a._score as number)).slice(0, limit);

  // Fetch seller info for top candidates
  const sellerIds = Array.from(new Set(scored.map(p => p.seller_id as string).filter(Boolean)));
  let sellerMap = new Map<string, Record<string, unknown>>();
  if (sellerIds.length > 0) {
    const sellersResp = await fetch(
      `${SUPABASE_URL}/rest/v1/sellers?id=in.(${sellerIds.join(',')})&select=id,business_name,profile_image`,
      { headers: adminHeaders }
    );
    (await sellersResp.json()).forEach((s: Record<string, unknown>) => sellerMap.set(s.id as string, s));
  }

  // Build recommendation objects with rule-based reasons (no AI call needed for the reasons — keeps it fast)
  const reasons: Record<string, string> = {
    followed_seller: 'From a seller you follow',
    similar_category: 'Similar to what you have bought before',
    trending: 'Popular right now',
  };

  let recommendations = scored.map(p => {
    const seller = sellerMap.get(p.seller_id as string);
    const reason = reasons[p._signal as string] || 'Recommended for you';
    return {
      product: {
        id: p.id, name: p.name, price: p.price,
        image_url: p.image_url, category: p.category,
        units_sold: p.units_sold || 0,
        seller: seller ? { id: seller.id, business_name: seller.business_name, profile_image: seller.profile_image } : null,
      },
      reason,
      signal: p._signal,
    };
  });

  // Optionally enrich with AI-generated explanation
  const useAI = HF_TOKEN && recommendations.length > 0;
  if (useAI) {
    try {
      const prompt = buildReasoningPrompt(recommendations, {
        purchasedCategories: Object.keys(purchasedCategoryCounts),
        followedSellers: followedSellerIds.size,
        wishlistCount: wishlistProductIds.size,
        cartCount: cartProductIds.size,
      });

      const aiResp = await fetch(HF_ROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: HF_INFERENCE_MODEL,
          messages: [
            { role: 'system', content: 'You are a shopping assistant. For each product, write a 1-sentence personalized recommendation reason. Be specific and friendly. Respond ONLY with valid JSON: {"reasons": ["reason1", "reason2", ...]}' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const text = aiData.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.reasons)) {
            recommendations = recommendations.map((r, i) => ({
              ...r,
              reason: parsed.reasons[i] || r.reason,
            }));
          }
        }
      }
    } catch (e) {
      console.warn('AI enrichment failed, using rule-based reasons:', e);
    }
  }

  const signals = {
    purchase_count: purchasedProductIds.size,
    cart_count: cartProductIds.size,
    wishlist_count: wishlistProductIds.size,
    followed_sellers: followedSellerIds.size,
    top_categories: Object.entries(purchasedCategoryCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c),
  };

  return jsonResponse({ success: true, recommendations, signals });
}

function buildReasoningPrompt(recs: Record<string, unknown>[], signals: Record<string, unknown>): string {
  const productLines = recs.map((r, i) => {
    const p = r.product as Record<string, unknown>;
    return `${i + 1}. "${p.name}" ($${p.price}) — category: ${p.category}, signal: ${r.signal}`;
  }).join('\n');

  return `User signals:
- Past purchases: ${signals.purchasedCategories?.length || 0} categories (${(signals.purchasedCategories as string[])?.join(', ')})
- Followed sellers: ${signals.followedSellers}
- Wishlist items: ${signals.wishlistCount}
- Cart items: ${signals.cartCount}

Recommendations to explain:
${productLines}

Write a personalized 1-sentence reason for each (max 15 words). Reference the user's signals when relevant.`;
}

async function handleLogView(userId: string, body: Record<string, unknown>): Promise<Response> {
  const productId = Number(body.productId);
  if (!productId) return errorResponse('productId is required', 400);
  await fetch(`${SUPABASE_URL}/rest/v1/product_view_log`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, user_id: userId, source: 'discover' }),
  }).catch(() => {});
  return jsonResponse({ success: true });
}
