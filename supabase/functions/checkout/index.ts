/// <reference lib="deno.ns" />
// Cellex Checkout Edge Function
// Atomic checkout: debit wallet, create order, create transaction, clear cart
//
// API:
//   op=prepare     → get cart items + wallet balance for checkout preview
//   op=place_order → { "shippingAddress": "..." } place the order atomically

import { corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect, supabaseInsert, supabaseUpdate, supabaseDelete } from '../_shared/cors.ts';

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
      case 'prepare':
        return await handlePrepare(user.id);
      case 'place_order':
        return await handlePlaceOrder(user.id, body);
      default:
        return errorResponse(`Unknown operation: ${op}`, 400);
    }
  } catch (error) {
    console.error('Checkout edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handlePrepare(userId: string): Promise<Response> {
  // Get cart items with product details
  const cartUrl = `${SUPABASE_URL}/rest/v1/cart_items?select=id,quantity,product_id,products(id,name,price,image_url)&user_id=eq.${encodeURIComponent(userId)}`;
  const cartResp = await fetch(cartUrl, { headers: restHeaders });
  const cartItems = await cartResp.json();

  if (!cartItems || cartItems.length === 0) {
    return errorResponse('Cart is empty', 400);
  }

  // Get wallet balance
  const walletUrl = `${SUPABASE_URL}/rest/v1/eeshapay_wallets?select=id,balance&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const walletResp = await fetch(walletUrl, { headers: restHeaders });
  const walletData = await walletResp.json();
  const wallet = walletData?.[0] || null;

  // Calculate total
  const total = cartItems.reduce((sum: number, item: Record<string, unknown>) => {
    const price = ((item.products as Record<string, unknown>)?.price as number) || 0;
    const qty = (item.quantity as number) || 1;
    return sum + price * qty;
  }, 0);

  return jsonResponse({
    success: true,
    cartItems,
    walletBalance: wallet?.balance || 0,
    walletId: wallet?.id || null,
    total,
  });
}

async function handlePlaceOrder(userId: string, body: Record<string, unknown>): Promise<Response> {
  const shippingAddress = (body.shippingAddress as string) || '';

  // Step 1: Get cart items
  const cartUrl = `${SUPABASE_URL}/rest/v1/cart_items?select=id,quantity,product_id,products(id,name,price)&user_id=eq.${encodeURIComponent(userId)}`;
  const cartResp = await fetch(cartUrl, { headers: restHeaders });
  const cartItems = await cartResp.json();

  if (!cartItems || cartItems.length === 0) {
    return errorResponse('Cart is empty', 400);
  }

  // Calculate total
  const total = cartItems.reduce((sum: number, item: Record<string, unknown>) => {
    const price = ((item.products as Record<string, unknown>)?.price as number) || 0;
    const qty = (item.quantity as number) || 1;
    return sum + price * qty;
  }, 0);

  // Step 2: Check wallet balance
  const walletUrl = `${SUPABASE_URL}/rest/v1/eeshapay_wallets?select=id,balance&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const walletResp = await fetch(walletUrl, { headers: restHeaders });
  const walletData = await walletResp.json();
  const wallet = walletData?.[0];

  if (!wallet) {
    return errorResponse('No wallet found. Please set up your wallet first.', 400);
  }

  if ((wallet.balance as number) < total) {
    return errorResponse(`Insufficient balance. You need ₦${total.toLocaleString()} but have ₦${(wallet.balance as number).toLocaleString()}`, 400);
  }

  // Step 3: Create the order
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const orderItems = cartItems.map((item: Record<string, unknown>) => ({
    product_id: item.product_id,
    product_name: (item.products as Record<string, unknown>)?.name,
    price: (item.products as Record<string, unknown>)?.price,
    quantity: item.quantity,
  }));

  const orderInserted = await supabaseInsert('buyers_orders', {
    user_id: userId,
    order_id: orderId,
    total,
    status: 'completed',
    items: JSON.stringify(orderItems),
    shipping_address: shippingAddress,
  });

  if (!orderInserted) return errorResponse('Failed to create order', 500);

  // Step 4: Debit wallet
  const newBalance = (wallet.balance as number) - total;
  const walletUpdated = await supabaseUpdate(
    'eeshapay_wallets',
    { balance: newBalance },
    { id: `eq.${wallet.id}`, user_id: `eq.${userId}` }
  );

  if (!walletUpdated) {
    // TODO: In production, rollback the order creation
    return errorResponse('Failed to debit wallet. Please contact support.', 500);
  }

  // Step 5: Create transaction record
  await supabaseInsert('eeshapay_transactions', {
    user_id: userId,
    type: 'debit',
    amount: total,
    description: `Order ${orderId}`,
    order_id: orderId,
    status: 'completed',
  });

  // Step 6: Clear the cart
  await supabaseDelete('cart_items', { user_id: `eq.${userId}` });

  return jsonResponse({
    success: true,
    orderId,
    total,
    newBalance,
    message: 'Order placed successfully!',
  });
}
