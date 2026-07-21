import { NextRequest, NextResponse } from 'next/server';
import { proxyToEdgeFunction } from '@/lib/proxy';
import { upsertProductToChroma, deleteProductFromChroma } from '@/lib/ai';

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
  } catch (err) {
    console.warn('[seller-products] Chroma sync hook error:', err);
  }

  return response;
}
