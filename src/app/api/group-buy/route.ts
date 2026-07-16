import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Group Buy API
 *
 * Operations:
 *   - start:    Buyer starts a new group buy for a product (creates invite link)
 *   - join:     Buyer joins an existing group buy via invite code
 *   - status:   Get status of a group buy
 *   - active:   Get active group buys for a product
 *   - mine:     Get group buys the user has joined
 *   - enable:   Seller enables group buy for a product (sets target + discount)
 *   - disable:  Seller disables group buy for a product
 */

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(-4);
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const sqlHeaders: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const sqlApiUrl = `https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query`;

  // --- Operations that don't require auth ---
  if (body.op === 'status') {
    const gbId = body.groupBuyId;
    if (!gbId) return NextResponse.json({ success: false, error: 'groupBuyId required' }, { status: 400 });
    const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT gb.*, p.name as product_name, p.image_url, p.price, p.group_buy_enabled, p.group_buy_target_count, p.group_buy_discount_pct FROM group_buys gb JOIN products p ON gb.product_id = p.id WHERE gb.id = '${gbId}'::uuid;` }) });
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) return NextResponse.json({ success: true, groupBuy: data[0] });
    return NextResponse.json({ success: false, error: 'Group buy not found' }, { status: 404 });
  }

  if (body.op === 'open') {
    const productId = body.productId;
    if (!productId) return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 });
    const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT * FROM group_buys WHERE product_id = ${productId} AND status = 'open' ORDER BY created_at DESC;` }) });
    const data = await resp.json();
    return NextResponse.json({ success: true, groupBuys: Array.isArray(data) ? data : [] });
  }

  if (body.op === 'invite') {
    // Get group buy by invite code (public — no auth needed)
    const code = body.inviteCode;
    if (!code) return NextResponse.json({ success: false, error: 'inviteCode required' }, { status: 400 });
    const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT gb.*, p.name as product_name, p.image_url, p.price, p.group_buy_target_count, p.group_buy_discount_pct, u.email as initiator_email FROM group_buys gb JOIN products p ON gb.product_id = p.id LEFT JOIN auth.users u ON gb.initiator_id = u.id WHERE gb.invite_code = '${code.replace(/'/g, "''")}';` }) });
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) return NextResponse.json({ success: true, groupBuy: data[0] });
    return NextResponse.json({ success: false, error: 'Invalid invite code' }, { status: 404 });
  }

  // --- Operations that require auth ---
  if (!sessionId) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  // Get user
  const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'session' }),
  });
  const authData = await authResp.json();
  if (!authData.success || !authData.user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const userId = authData.user.id;
  const userEmail = authData.user.email;

  switch (body.op) {
    case 'enable': {
      // Seller enables group buy for a product
      const { productId, targetCount, discountPct } = body;
      if (!productId) return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 });
      const tc = targetCount || 3;
      const dp = discountPct || 20;
      const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `UPDATE products SET group_buy_enabled = true, group_buy_target_count = ${tc}, group_buy_discount_pct = ${dp} WHERE id = ${productId} AND seller_id = '${userId}'::uuid RETURNING *;` }) });
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) return NextResponse.json({ success: true, product: data[0] });
      return NextResponse.json({ success: false, error: 'Failed — not the seller or product not found' }, { status: 403 });
    }

    case 'disable': {
      const { productId } = body;
      if (!productId) return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 });
      const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `UPDATE products SET group_buy_enabled = false WHERE id = ${productId} AND seller_id = '${userId}'::uuid RETURNING *;` }) });
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) return NextResponse.json({ success: true, product: data[0] });
      return NextResponse.json({ success: false, error: 'Failed' }, { status: 403 });
    }

    case 'start': {
      // Buyer starts a new group buy for a product
      const { productId } = body;
      if (!productId) return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 });

      // Check if product has group buy enabled
      const checkResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT group_buy_enabled, group_buy_target_count, group_buy_discount_pct, seller_id FROM products WHERE id = ${productId};` }) });
      const checkData = await checkResp.json();
      if (!Array.isArray(checkData) || checkData.length === 0) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      const product = checkData[0];
      if (!product.group_buy_enabled) return NextResponse.json({ success: false, error: 'Seller has not enabled group buy for this product' }, { status: 400 });

      const inviteCode = generateInviteCode();
      const targetCount = product.group_buy_target_count || 3;
      const discountPct = product.group_buy_discount_pct || 20;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      // Create group buy
      const createResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `INSERT INTO group_buys (product_id, seller_id, initiator_id, target_count, current_count, discount_pct, status, expires_at, invite_code) VALUES (${productId}, '${product.seller_id}'::uuid, '${userId}'::uuid, ${targetCount}, 1, ${discountPct}, 'open', '${expiresAt}', '${inviteCode}') RETURNING *;` }) });
      const createData = await createResp.json();
      if (!Array.isArray(createData) || createData.length === 0) return NextResponse.json({ success: false, error: 'Failed to create group buy' }, { status: 500 });
      const groupBuy = createData[0];

      // Add initiator as first member
      await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `INSERT INTO group_buy_members (group_buy_id, user_id) VALUES ('${groupBuy.id}'::uuid, '${userId}'::uuid);` }) });

      // Create a conversation for this group buy
      const convResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `INSERT INTO conversations (type, participant1, participant2, group_buy_id) VALUES ('group_buy', '${userId}'::uuid, '${product.seller_id}'::uuid, '${groupBuy.id}'::uuid) RETURNING *;` }) });
      const convData = await convResp.json();
      let conversationId = null;
      if (Array.isArray(convData) && convData.length > 0) {
        conversationId = convData[0].id;
        // Link conversation to group buy
        await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `UPDATE group_buys SET conversation_id = '${conversationId}'::uuid WHERE id = '${groupBuy.id}'::uuid;` }) });
      }

      return NextResponse.json({ success: true, groupBuy: { ...groupBuy, conversationId, inviteLink: `/group-buy-join?code=${inviteCode}` } });
    }

    case 'join': {
      // Buyer joins a group buy via invite code
      const { inviteCode } = body;
      if (!inviteCode) return NextResponse.json({ success: false, error: 'inviteCode required' }, { status: 400 });

      // Get group buy
      const gbResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT * FROM group_buys WHERE invite_code = '${inviteCode.replace(/'/g, "''")}' AND status = 'open';` }) });
      const gbData = await gbResp.json();
      if (!Array.isArray(gbData) || gbData.length === 0) return NextResponse.json({ success: false, error: 'Group buy not found or expired' }, { status: 404 });
      const groupBuy = gbData[0];

      // Check if already a member
      const memberResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT * FROM group_buy_members WHERE group_buy_id = '${groupBuy.id}'::uuid AND user_id = '${userId}'::uuid;` }) });
      const memberData = await memberResp.json();
      if (Array.isArray(memberData) && memberData.length > 0) return NextResponse.json({ success: false, error: 'You are already a member of this group buy' }, { status: 400 });

      // Check if group buy is full
      if (groupBuy.current_count >= groupBuy.target_count) return NextResponse.json({ success: false, error: 'Group buy is full' }, { status: 400 });

      // Add member
      await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `INSERT INTO group_buy_members (group_buy_id, user_id) VALUES ('${groupBuy.id}'::uuid, '${userId}'::uuid);` }) });

      // Increment count
      const newCount = groupBuy.current_count + 1;
      const isComplete = newCount >= groupBuy.target_count;
      const updateResp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `UPDATE group_buys SET current_count = ${newCount}, status = '${isComplete ? 'completed' : 'open'}', completed_at = ${isComplete ? 'NOW()' : 'NULL'} WHERE id = '${groupBuy.id}'::uuid RETURNING *;` }) });
      const updateData = await updateResp.json();

      // Add user to the group buy's conversation
      if (groupBuy.conversation_id) {
        // The conversation was created between initiator and seller.
        // For a true group chat, we'd need a many-to-many table.
        // For now, we create a new conversation between the joining user and the initiator.
        await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `INSERT INTO conversations (type, participant1, participant2, group_buy_id) VALUES ('group_buy', '${userId}'::uuid, '${groupBuy.initiator_id}'::uuid, '${groupBuy.id}'::uuid) ON CONFLICT DO NOTHING;` }) });
      }

      return NextResponse.json({ success: true, groupBuy: Array.isArray(updateData) && updateData.length > 0 ? updateData[0] : groupBuy });
    }

    case 'mine': {
      // Get group buys the user has joined
      const resp = await fetch(sqlApiUrl, { method: 'POST', headers: sqlHeaders, body: JSON.stringify({ query: `SELECT gb.*, p.name as product_name, p.image_url, p.price FROM group_buys gb JOIN group_buy_members gbm ON gb.id = gbm.group_buy_id JOIN products p ON gb.product_id = p.id WHERE gbm.user_id = '${userId}'::uuid ORDER BY gb.created_at DESC;` }) });
      const data = await resp.json();
      return NextResponse.json({ success: true, groupBuys: Array.isArray(data) ? data : [] });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}
