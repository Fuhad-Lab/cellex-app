import { NextRequest, NextResponse } from 'next/server';
import { proxyToEdgeFunction } from '@/lib/proxy';
import { upsertProductToChroma, deleteProductFromChroma } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1`
  : 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';

/**
 * Seller Products API — proxies to the Supabase Edge Function,
 * AND keeps Chroma vector DB in sync on create/update/delete.
 *
 * Incremental sync flow:
 *   - op=create  → after Supabase returns the new product, embed it into Chroma
 *   - op=update  → after Supabase updates, re-embed (Chroma's `add` is upsert)
 *   - op=delete  → after Supabase deletes, remove from Chroma
 *
 * The Chroma sync is best-effort: if NVIDIA/Chroma is down, the Supabase write
 * still succeeds — we just log a warning. The next /api/recommend call will
 * still work (it falls back to trending from Supabase).
 */
export async function POST(request: NextRequest) {
  // Clone the request so we can read the body without consuming it from the proxy
  const cloned = request.clone();
  let op = '';
  let productId: string | number | undefined;
  let productPayload: any = undefined;
  try {
    const body = await cloned.json();
    op = body.op || '';
    productId = body.id || body.productId;
    // For create/update, the product fields are in the body itself
    if (op === 'create' || op === 'update') {
      productPayload = {
        id: productId,
        name: body.name,
        category: body.category,
        description: body.description,
        price: body.price,
        image_url: body.image_url,
      };
    }
  } catch {
    // Not JSON or empty — that's fine, just proxy through
  }

  // Forward to the Supabase Edge Function
  const response = await proxyToEdgeFunction('seller-products', request);

  // After a successful create/update/delete, sync Chroma in the background
  try {
    if (op === 'create' || op === 'update') {
      // For create, the edge function returns the new product id in the response.
      // We need to read it from the proxied response.
      const respClone = response.clone();
      const data = await respClone.json();
      const realProductId = data?.product?.id || data?.id || productId;
      if (realProductId && productPayload) {
        productPayload.id = realProductId;
        // Fire and forget — don't block the seller's request
        upsertProductToChroma(realProductId, productPayload).then((ok) => {
          if (!ok) console.warn(`[seller-products] Chroma sync failed for product ${realProductId}`);
        });
      }
    } else if (op === 'delete') {
      if (productId) {
        deleteProductFromChroma(productId).then((ok) => {
          if (!ok) console.warn(`[seller-products] Chroma delete failed for product ${productId}`);
        });
      }
    }

    // === NEW PRODUCT NOTIFICATION ===
    // When a seller creates a product, notify all their followers.
    if (op === 'create') {
      const respClone2 = response.clone();
      const data2 = await respClone2.json();
      const newProductId = data2?.product?.id || data2?.id;
      const sellerId = data2?.product?.seller_id;
      const productName = data2?.product?.name || productPayload?.name || 'a new product';
      if (newProductId && sellerId) {
        // Fire-and-forget: notify all followers via the social edge function
        fetch(`${EDGE_FUNCTIONS_URL}/social`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'notify_followers_product',
            sellerId,
            productId: newProductId,
            productName,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[seller-products] post-create hook error:', err);
  }

  return response;
}
