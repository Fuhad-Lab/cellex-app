import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Checkout API — creates an order from the user's cart.
 *
 * SECURITY:
 * - Prices are fetched from the DATABASE (never from the client)
 * - User identity is verified via session
 * - The order total is calculated server-side
 * - This route goes through the Edge Function which uses the service role key
 *
 * Flow:
 * 1. Get user's cart items from DB
 * 2. Fetch REAL product prices from DB (never trust client prices)
 * 3. Calculate total (subtotal + shipping)
 * 4. Create order in buyers_orders table
 * 5. Create order items in buyers_order_items table
 * 6. Clear the cart
 * 7. Return order ID + total
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Forward to the social Edge Function which handles order creation
  // with server-side price verification
  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        op: 'checkout_place_order',
        shippingAddress: body.shippingAddress || body,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: 'Invalid response' }; }
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Checkout service unavailable' }, { status: 500 });
  }
}
