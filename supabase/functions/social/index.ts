/// <reference lib="deno.ns" />
// Cellex Social Edge Function — UPDATED with feed_posts, comments, feedback, notifications,
// group_buy, and messenger operations.
//
// All ops use the SUPABASE_SERVICE_ROLE_KEY (valid) — NOT the management API token.
//
// EXISTING ops:
//   op=public_profile   op=follow   op=unfollow   op=following
//   op=feed   op=seller_feed   op=discover
//   op=feed_post_create   op=feed_post_list   op=feed_post_delete
//   op=comment_list   op=comment_create   op=comment_delete
//   op=feedback_write
//   op=notifications_list   op=notifications_mark_read   op=notifications_mark_all_read
//   op=notifications_unread_count
//
// NEW ops (group buy):
//   op=group_buy_enable    body: { productId, targetCount, discountPct }
//   op=group_buy_disable   body: { productId }
//   op=group_buy_start     body: { productId }  -> creates group_buy + conversation
//   op=group_buy_join      body: { inviteCode } -> adds member + creates conversation with initiator
//   op=group_buy_invite    body: { inviteCode } -> public lookup
//   op=group_buy_status    body: { groupBuyId } -> public status
//   op=group_buy_mine      body: {} -> my group buys
//
// NEW ops (messenger):
//   op=messenger_list      body: {} -> my conversations
//   op=messenger_messages  body: { conversationId }
//   op=messenger_send      body: { conversationId, encryptedContent, iv }
//   op=messenger_create    body: { otherUserId, type?, groupBuyId? }

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
  supabaseSelect, supabaseInsert, supabaseDelete, supabaseUpdate, supabaseRest,
} from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op || 'discover';
    const user = await getUser(req);

    switch (op) {
      // === Social ===
      case 'public_profile':   return await handlePublicProfile(body);
      case 'follow':           return await handleFollow(body, user);
      case 'unfollow':         return await handleUnfollow(body, user);
      case 'following':        return await handleFollowing(user);
      case 'feed':             return await handleFeed(body);
      case 'seller_feed':      return await handleSellerFeed(body);
      case 'discover':         return await handleDiscover(body);

      // === Feed Posts ===
      case 'feed_post_create': return await handleFeedPostCreate(body, user);
      case 'feed_post_list':   return await handleFeedPostList(body);
      case 'feed_post_delete': return await handleFeedPostDelete(body, user);

      // === Comments ===
      case 'comment_list':     return await handleCommentList(body);
      case 'comment_create':   return await handleCommentCreate(body, user);
      case 'comment_delete':   return await handleCommentDelete(body, user);

      // === Feedback ===
      case 'feedback_write':   return await handleFeedbackWrite(body, user);

      // === Notifications ===
      case 'notifications_list':          return await handleNotificationsList(body, user);
      case 'notifications_mark_read':     return await handleNotificationsMarkRead(body, user);
      case 'notifications_mark_all_read': return await handleNotificationsMarkAllRead(user);
      case 'notifications_unread_count':  return await handleNotificationsUnreadCount(user);

      // === Group Buy ===
      case 'group_buy_enable':   return await handleGroupBuyEnable(body, user);
      case 'group_buy_disable':  return await handleGroupBuyDisable(body, user);
      case 'group_buy_start':    return await handleGroupBuyStart(body, user);
      case 'group_buy_join':     return await handleGroupBuyJoin(body, user);
      case 'group_buy_invite':   return await handleGroupBuyInvite(body);
      case 'group_buy_status':   return await handleGroupBuyStatus(body);
      case 'group_buy_mine':     return await handleGroupBuyMine(user);

      // === Messenger ===
      case 'messenger_list':      return await handleMessengerList(user);
      case 'messenger_messages':  return await handleMessengerMessages(body, user);
      case 'messenger_send':      return await handleMessengerSend(body, user);
      case 'messenger_create':    return await handleMessengerCreate(body, user);
      case 'messenger_unread':    return await handleMessengerUnread(user);

      // === Personalization (pgvector) ===
      case 'pgvector_similar':    return await handlePgvectorSimilar(body, user);
      case 'products_by_ids':     return await handleProductsByIds(body);
      case 'pgvector_search':     return await handlePgvectorSearch(body);

      // === Follower Notifications (requires auth + internal call) ===
      case 'notify_followers_product': return await handleNotifyFollowersProduct(body, user);

      // === Public Seller Lookup ===
      case 'seller_by_slug':       return await handleSellerBySlug(body);

      // === Payments (Paystack) ===
      case 'payment_get_banks':         return await handlePaymentGetBanks(body);
      case 'payment_get_bank_details':  return await handlePaymentGetBankDetails(body, user);
      case 'payment_save_bank_details': return await handlePaymentSaveBankDetails(body, user);
      case 'payment_initialize':        return await handlePaymentInitialize(body, user);
      case 'payment_verify':            return await handlePaymentVerify(body, user);
      case 'payment_get_earnings':      return await handlePaymentGetEarnings(body, user);
      case 'payment_request_payout':    return await handlePaymentRequestPayout(body, user);

      // === Checkout (creates order with server-side price verification) ===
      case 'checkout_place_order':      return await handleCheckoutPlaceOrder(body, user);

      // === AI Chat (routes through backend → NVIDIA/ZAI API) ===
      case 'ai_chat':                   return await handleAiChat(body, user);

      // === NVIDIA Embeddings (for semantic search) ===
      case 'generate_embedding':        return await handleGenerateEmbedding(body, user);

      default: return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (err) {
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
});

// ===== EXISTING HANDLERS =====
async function handlePublicProfile(body: any) {
  if (!body.sellerId) return errorResponse('sellerId required', 400);
  const data = await supabaseSelect('sellers', '*', { id: `eq.${body.sellerId}` }, { limit: 1 });
  if (!data.length) return errorResponse('Seller not found', 404);
  return jsonResponse({ success: true, seller: data[0] });
}

async function handleFollow(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  if (!body.sellerId) return errorResponse('sellerId required', 400);
  if (body.sellerId === user.id) return errorResponse('Cannot follow yourself', 400);

  await supabaseInsert('seller_follows', { follower_id: user.id, seller_id: body.sellerId });

  // Notify the seller that they have a new follower.
  // Get the follower's display name (from sellers table first, then auth email).
  let followerName = 'A user';
  try {
    const followerSellers = await supabaseSelect('sellers', 'business_name,email', { id: `eq.${user.id}` }, { limit: 1 });
    if (followerSellers.length && (followerSellers[0] as any).business_name) {
      followerName = (followerSellers[0] as any).business_name;
    } else {
      // Try auth admin API for email
      const { url, headers } = supabaseRest();
      const uResp = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
        headers: { 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
      });
      if (uResp.ok) {
        const u = await uResp.json();
        followerName = u.email?.split('@')[0] || 'A user';
      }
    }
  } catch {}

  await supabaseInsert('buyers_notifications', {
    user_id: body.sellerId,
    type: 'follow',
    title: 'New follower',
    message: `${followerName} started following you`,
    data: { followerId: user.id, followerName },
    read: false,
  }).catch(() => {}); // Non-fatal if notification insert fails

  return jsonResponse({ success: true, isFollowing: true });
}

async function handleUnfollow(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  await supabaseDelete('seller_follows', { follower_id: `eq.${user.id}`, seller_id: `eq.${body.sellerId}` });
  return jsonResponse({ success: true, isFollowing: false });
}

async function handleFollowing(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const data = await supabaseSelect('seller_follows', 'seller_id', { follower_id: `eq.${user.id}` });
  return jsonResponse({ success: true, sellers: data || [] });
}

async function handleFeed(body: any) {
  const data = await supabaseSelect('activity_feed', '*', {}, { order: 'created_at', limit: body.limit || 20 });
  return jsonResponse({ success: true, items: data || [] });
}

async function handleSellerFeed(body: any) {
  const data = await supabaseSelect('activity_feed', '*', { seller_id: `eq.${body.sellerId}` }, { order: 'created_at', limit: body.limit || 20 });
  return jsonResponse({ success: true, items: data || [] });
}

async function handleDiscover(body: any) {
  const data = await supabaseSelect('sellers', 'id,business_name,profile_image,slug,business_category', {}, { order: 'created_at', limit: body.limit || 12 });
  return jsonResponse({ success: true, sellers: data || [] });
}

// ===== FEED POSTS =====
async function handleFeedPostCreate(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);

  const sellers = await supabaseSelect('sellers', 'id', { id: `eq.${user.id}` }, { limit: 1 });
  if (!sellers.length) return errorResponse('Seller account required', 403);

  const { postType, productId, caption, mediaUrl, thumbnailUrl } = body;
  if (!['video', 'photo', 'text', 'story'].includes(postType)) return errorResponse('Invalid post type', 400);
  if (!productId) return errorResponse('Product attachment required', 400);
  if (postType !== 'text' && !mediaUrl) return errorResponse('Media required', 400);

  const insertData: Record<string, unknown> = {
    seller_id: user.id,
    post_type: postType,
    product_id: Number(productId),
    caption: (caption || '').slice(0, 2000),
    media_url: (mediaUrl || '').slice(0, 1000),
    thumbnail_url: (thumbnailUrl || '').slice(0, 1000),
  };

  if (postType === 'story') {
    insertData.story_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const result = await supabaseInsert('feed_posts', insertData);
  if (!result) return errorResponse('Failed to create post', 500);

  // Notify all followers of this seller that they made a new post/story.
  // This runs in the background (fire-and-forget) so it doesn't slow down
  // the post creation response.
  (async () => {
    try {
      // Get all followers of this seller
      const followers = await supabaseSelect('seller_follows', 'follower_id',
        { seller_id: `eq.${user.id}` });
      if (!followers || followers.length === 0) return;

      // Get seller's display name
      let sellerName = 'A seller';
      const sellerRows = await supabaseSelect('sellers', 'business_name', { id: `eq.${user.id}` }, { limit: 1 });
      if (sellerRows.length && (sellerRows[0] as any).business_name) {
        sellerName = (sellerRows[0] as any).business_name;
      }

      // Build the notification message based on post type
      const postTypeLabel = postType === 'story' ? 'a story' : postType === 'video' ? 'a video' : postType === 'photo' ? 'a photo' : 'a post';
      const notifTitle = postType === 'story' ? 'New story' : 'New post';
      const notifMessage = `${sellerName} just posted ${postTypeLabel}`;
      const notifData = {
        sellerId: user.id,
        sellerName,
        postType,
        postId: (result as any).id,
        productId: Number(productId),
      };

      // Insert a notification for EACH follower (batch)
      // Using Promise.all for parallel inserts
      const notifPromises = (followers as any[]).map(f =>
        supabaseInsert('buyers_notifications', {
          user_id: f.follower_id,
          type: 'new_post',
          title: notifTitle,
          message: notifMessage,
          data: notifData,
          read: false,
        }).catch(() => {}) // Non-fatal if individual insert fails
      );
      await Promise.all(notifPromises);
    } catch (err) {
      console.error('Followers notification error:', err);
    }
  })();

  return jsonResponse({ success: true, post: result });
}

async function handleFeedPostList(body: any) {
  const { url, headers } = supabaseRest();
  const limit = Math.min(body.limit || 50, 100);
  let query = `${url}/rest/v1/feed_posts?select=*,products(id,name,price,image_url,units_sold,category,group_buy_enabled),sellers!feed_posts_seller_id_fkey(id,business_name,profile_image,slug)&order=created_at.desc&limit=${limit}&status=eq.active`;

  if (body.sellerId) query += `&seller_id=eq.${encodeURIComponent(body.sellerId)}`;

  const resp = await fetch(query, { headers });
  if (!resp.ok) return errorResponse('Database error', 500);
  const posts = await resp.json();

  const result = (posts || []).filter((p: any) => {
    if (p.post_type === 'story' && p.story_expires_at && new Date(p.story_expires_at) < new Date()) return false;
    return true;
  }).map((p: any) => ({
    id: p.id,
    postType: p.post_type,
    caption: p.caption,
    mediaUrl: p.media_url,
    thumbnailUrl: p.thumbnail_url,
    viewsCount: p.views_count,
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    createdAt: p.created_at,
    storyExpiresAt: p.story_expires_at,
    product: p.products ? {
      id: p.products.id, name: p.products.name, price: p.products.price,
      image_url: p.products.image_url, units_sold: p.products.units_sold,
      category: p.products.category, group_buy_enabled: p.products.group_buy_enabled,
    } : null,
    seller: p.sellers ? {
      name: p.sellers.business_name, image: p.sellers.profile_image, slug: p.sellers.slug,
    } : null,
  }));

  return jsonResponse({ success: true, posts: result });
}

async function handleFeedPostDelete(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { url, headers } = supabaseRest();
  const resp = await fetch(`${url}/rest/v1/feed_posts?id=eq.${body.postId}&seller_id=eq.${user.id}`, {
    method: 'DELETE',
    headers: { ...headers, 'Prefer': 'return=representation' },
  });
  const result = await resp.json();
  if (result.length) return jsonResponse({ success: true, deleted: true });
  return errorResponse('Post not found', 404);
}

// ===== COMMENTS =====
async function handleCommentList(body: any) {
  const data = await supabaseSelect('feed_comments', 'id,comment_text,created_at,user_id,user_name,user_image',
    { post_type: `eq.${body.postType}`, post_id: `eq.${body.postId}` },
    { order: 'created_at', limit: body.limit || 50 });
  return jsonResponse({
    success: true,
    comments: (data || []).map((c: any) => ({
      id: c.id, text: c.comment_text, createdAt: c.created_at,
      userId: c.user_id, userName: c.user_name || 'User', userImage: c.user_image || '',
    })),
  });
}

async function handleCommentCreate(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const text = (body.commentText || '').trim();
  if (!text) return errorResponse('Comment cannot be empty', 400);

  const result = await supabaseInsert('feed_comments', {
    post_type: body.postType,
    post_id: Number(body.postId),
    user_id: user.id,
    comment_text: text.slice(0, 1000),
    user_name: (user.email?.split('@')[0] || 'User').slice(0, 100),
    user_image: '',
  });
  if (!result) return errorResponse('Failed to post comment', 500);
  return jsonResponse({ success: true, comment: { id: (result as any).id, text, createdAt: (result as any).created_at, userId: user.id, userName: (result as any).user_name, userImage: '' } });
}

async function handleCommentDelete(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const ok = await supabaseDelete('feed_comments', { id: `eq.${body.commentId}`, user_id: `eq.${user.id}` });
  return jsonResponse({ success: ok });
}

// ===== FEEDBACK =====
async function handleFeedbackWrite(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { itemId, type, metadata } = body;
  const s = String(itemId);
  let itemType = 'product';
  let rawId = s;
  if (s.startsWith('video:')) { itemType = 'video'; rawId = s.slice(6); }
  else if (s.startsWith('product:')) { rawId = s.slice(8); }

  if (itemType !== 'product' || !/^\d+$/.test(rawId)) return jsonResponse({ success: true });
  const productId = Number(rawId);
  const source = (metadata?.page || 'feed').slice(0, 50);

  if (type === 'view') {
    await supabaseInsert('product_view_log', { product_id: productId, user_id: user.id, source });
  } else if (type === 'save') {
    const { url, headers } = supabaseRest();
    await fetch(`${url}/rest/v1/buyers_wishlist`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: user.id, product_id: productId }),
    });
  } else if (type === 'unsave') {
    await supabaseDelete('buyers_wishlist', { user_id: `eq.${user.id}`, product_id: `eq.${productId}` });
  }
  return jsonResponse({ success: true });
}

// ===== NOTIFICATIONS =====
async function handleNotificationsList(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const data = await supabaseSelect('buyers_notifications', 'id,type,title,message,data,read,created_at',
    { user_id: `eq.${user.id}` }, { order: 'created_at', limit: body.limit || 50 });
  return jsonResponse({
    success: true,
    notifications: (data || []).map((n: any) => ({
      id: n.id, type: n.type || 'system', title: n.title || '', body: n.message || '',
      data: n.data || {}, read: !!n.read, timestamp: n.created_at,
    })),
  });
}

async function handleNotificationsMarkRead(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  await supabaseUpdate('buyers_notifications', { read: true }, { id: `eq.${body.notificationId}`, user_id: `eq.${user.id}` });
  return jsonResponse({ success: true });
}

async function handleNotificationsMarkAllRead(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  await supabaseUpdate('buyers_notifications', { read: true }, { user_id: `eq.${user.id}`, read: `eq.false` });
  return jsonResponse({ success: true });
}

async function handleNotificationsUnreadCount(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const data = await supabaseSelect('buyers_notifications', 'id', { user_id: `eq.${user.id}`, read: `eq.false` });
  return jsonResponse({ success: true, count: (data || []).length });
}

// ===== GROUP BUY =====
// Generates a short, URL-safe invite code.
function generateInviteCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code + Date.now().toString(36).slice(-4);
}

// Generates a catchy group buy name for the group conversation.
// e.g. "iPhone 15 Pro Max Squad", "Wireless Earbuds Crew"
function generateGroupBuyName(productName: string, discountPct: number, targetCount: number): string {
  const cleanName = (productName || 'Product').trim();
  const suffixes = ['Squad', 'Crew', 'Group', 'Deal', 'Bundle'];
  const suffix = suffixes[targetCount % suffixes.length] || 'Group';
  const maxNameLen = 50 - suffix.length - 1;
  const truncatedName = cleanName.length > maxNameLen
    ? cleanName.slice(0, maxNameLen - 1).trim() + '…'
    : cleanName;
  return `${truncatedName} ${suffix}`;
}

async function handleGroupBuyEnable(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { productId, targetCount, discountPct } = body;
  if (!productId) return errorResponse('productId required', 400);

  const tc = Math.max(2, Math.min(1000, Number(targetCount) || 3));
  const dp = Math.max(1, Math.min(99, Number(discountPct) || 20));

  const updated = await supabaseUpdate('products',
    { group_buy_enabled: true, group_buy_target_count: tc, group_buy_discount_pct: dp },
    { id: `eq.${productId}`, seller_id: `eq.${user.id}` }
  );
  if (!updated || !updated.length) return errorResponse('Failed — not the seller or product not found', 403);
  return jsonResponse({ success: true, product: updated[0] });
}

async function handleGroupBuyDisable(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { productId } = body;
  if (!productId) return errorResponse('productId required', 400);

  const updated = await supabaseUpdate('products',
    { group_buy_enabled: false },
    { id: `eq.${productId}`, seller_id: `eq.${user.id}` }
  );
  if (!updated || !updated.length) return errorResponse('Failed', 403);
  return jsonResponse({ success: true, product: updated[0] });
}

async function handleGroupBuyStart(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { productId } = body;
  if (!productId) return errorResponse('productId required', 400);

  // Check if product has group buy enabled
  const products = await supabaseSelect('products',
    'id,name,image_url,price,seller_id,group_buy_enabled,group_buy_target_count,group_buy_discount_pct',
    { id: `eq.${productId}` }, { limit: 1 });
  if (!products.length) return errorResponse('Product not found', 404);
  const product: any = products[0];
  if (!product.group_buy_enabled) return errorResponse('Seller has not enabled group buy for this product', 400);

  const inviteCode = generateInviteCode();
  const targetCount = product.group_buy_target_count || 3;
  const discountPct = product.group_buy_discount_pct || 20;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Create group buy
  const groupBuy = await supabaseInsert('group_buys', {
    product_id: Number(productId),
    seller_id: product.seller_id,
    initiator_id: user.id,
    target_count: targetCount,
    current_count: 1,
    discount_pct: discountPct,
    status: 'open',
    expires_at: expiresAt,
    invite_code: inviteCode,
  });
  if (!groupBuy) return errorResponse('Failed to create group buy', 500);

  // Add initiator as first member
  await supabaseInsert('group_buy_members', {
    group_buy_id: (groupBuy as any).id,
    user_id: user.id,
  });

  // Auto-create a GROUP conversation for this group buy.
  // ALL members of the group buy will be added to THIS conversation (not
  // separate 1-on-1 conversations). This is a real group chat.
  let conversationId: string | null = null;
  const gbName = generateGroupBuyName(product.name || 'Product', discountPct, targetCount);
  const conv = await supabaseInsert('conversations', {
    type: 'group_buy',
    is_group: true,
    name: gbName,
    participant1: user.id,         // initiator (for backward compat with 1-on-1 queries)
    participant2: product.seller_id, // seller (for backward compat)
    group_buy_id: (groupBuy as any).id,
  });
  if (conv) {
    conversationId = (conv as any).id;
    // Link conversation back to group buy
    await supabaseUpdate('group_buys',
      { conversation_id: conversationId },
      { id: `eq.${(groupBuy as any).id}` }
    );
    // Add the initiator as a member of the group conversation
    await supabaseInsert('conversation_members', {
      conversation_id: conversationId,
      user_id: user.id,
      role: 'admin',
    });
    // Add the seller as a member too (so they can see and participate)
    if (user.id !== product.seller_id) {
      await supabaseInsert('conversation_members', {
        conversation_id: conversationId,
        user_id: product.seller_id,
        role: 'member',
      }).catch(() => {}); // Ignore duplicate errors
    }
  }

  return jsonResponse({
    success: true,
    groupBuy: {
      ...(groupBuy as any),
      conversationId,
      inviteLink: `/group-buy-join?code=${inviteCode}`,
    },
  });
}

async function handleGroupBuyJoin(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { inviteCode } = body;
  if (!inviteCode) return errorResponse('inviteCode required', 400);

  // Get the group buy
  const gbs = await supabaseSelect('group_buys', '*',
    { invite_code: `eq.${inviteCode}`, status: `eq.open` }, { limit: 1 });
  if (!gbs.length) return errorResponse('Group buy not found or expired', 404);
  const groupBuy: any = gbs[0];

  // Check if already a member
  const existing = await supabaseSelect('group_buy_members', 'id',
    { group_buy_id: `eq.${groupBuy.id}`, user_id: `eq.${user.id}` }, { limit: 1 });
  if (existing.length) return errorResponse('You are already a member of this group buy', 400);

  // Check if group buy is full
  if (groupBuy.current_count >= groupBuy.target_count) {
    return errorResponse('Group buy is full', 400);
  }

  // Add member
  await supabaseInsert('group_buy_members', {
    group_buy_id: groupBuy.id,
    user_id: user.id,
  });

  // Increment count and possibly complete
  const newCount = groupBuy.current_count + 1;
  const isComplete = newCount >= groupBuy.target_count;
  const updated = await supabaseUpdate('group_buys',
    {
      current_count: newCount,
      status: isComplete ? 'completed' : 'open',
      ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
    },
    { id: `eq.${groupBuy.id}` }
  );

  // Add the joiner to the EXISTING group conversation.
  // The conversation was created when the group buy was started — all
  // members share the same conversation. We just add the new member.
  let conversationId: string | null = groupBuy.conversation_id || null;
  if (conversationId) {
    // Add the joiner as a member of the group conversation (ignore if already exists)
    await supabaseInsert('conversation_members', {
      conversation_id: conversationId,
      user_id: user.id,
      role: 'member',
    }).catch(() => {}); // Ignore duplicate-key errors (user already a member)
  }

  return jsonResponse({
    success: true,
    groupBuy: (updated && updated.length) ? updated[0] : groupBuy,
    conversationId,
  });
}

async function handleGroupBuyInvite(body: any) {
  // Public — no auth needed (for share-link landing page)
  const { inviteCode } = body;
  if (!inviteCode) return errorResponse('inviteCode required', 400);

  const { url, headers } = supabaseRest();
  // Join group_buys with products and initiator email
  const resp = await fetch(
    `${url}/rest/v1/group_buys?select=*,products(id,name,image_url,price,group_buy_target_count,group_buy_discount_pct,sellers(id,business_name,profile_image,slug))&invite_code=eq.${encodeURIComponent(inviteCode)}&limit=1`,
    { headers }
  );
  if (!resp.ok) return errorResponse('Database error', 500);
  const data = await resp.json();
  if (!data.length) return errorResponse('Invalid invite code', 404);

  // Get initiator email from auth.users via service role
  const gb: any = data[0];
  let initiatorEmail = '';
  let initiatorName = 'A buyer';
  try {
    const userResp = await fetch(`${url}/auth/v1/admin/users/${gb.initiator_id}`, {
      headers: { 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
    });
    if (userResp.ok) {
      const u = await userResp.json();
      initiatorEmail = u.email || '';
      initiatorName = u.email?.split('@')[0] || 'A buyer';
    }
  } catch {}

  // Flatten the response so the group-buy-join page can read top-level fields
  // like groupBuy.image_url, groupBuy.product_name, groupBuy.price, etc.
  // (the old SQL API returned a flat JOIN row; we match that shape here).
  const product = gb.products || {};
  const seller = product.sellers || {};
  return jsonResponse({
    success: true,
    groupBuy: {
      id: gb.id,
      product_id: gb.product_id,
      seller_id: gb.seller_id,
      initiator_id: gb.initiator_id,
      target_count: gb.target_count,
      current_count: gb.current_count,
      discount_pct: gb.discount_pct,
      status: gb.status,
      expires_at: gb.expires_at,
      invite_code: gb.invite_code,
      conversation_id: gb.conversation_id,
      created_at: gb.created_at,
      completed_at: gb.completed_at,
      // Flattened product fields (what the page expects)
      product_name: product.name || '',
      image_url: product.image_url || '',
      price: product.price || 0,
      group_buy_target_count: product.group_buy_target_count || gb.target_count,
      group_buy_discount_pct: product.group_buy_discount_pct || gb.discount_pct,
      // Initiator info
      initiator_email: initiatorEmail,
      initiatorName,
      // Nested objects for callers that want them
      product,
      seller,
    },
  });
}

async function handleGroupBuyStatus(body: any) {
  const { groupBuyId } = body;
  if (!groupBuyId) return errorResponse('groupBuyId required', 400);

  const { url, headers } = supabaseRest();
  const resp = await fetch(
    `${url}/rest/v1/group_buys?select=*,products(id,name,image_url,price,group_buy_enabled,group_buy_target_count,group_buy_discount_pct)&id=eq.${encodeURIComponent(groupBuyId)}&limit=1`,
    { headers }
  );
  if (!resp.ok) return errorResponse('Database error', 500);
  const data = await resp.json();
  if (!data.length) return errorResponse('Group buy not found', 404);
  return jsonResponse({ success: true, groupBuy: data[0] });
}

async function handleGroupBuyMine(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { url, headers } = supabaseRest();
  const resp = await fetch(
    `${url}/rest/v1/group_buy_members?select=group_buys(id,product_id,seller_id,initiator_id,target_count,current_count,discount_pct,status,expires_at,invite_code,created_at,products(id,name,image_url,price))&user_id=eq.${user.id}&order=created_at.desc`,
    { headers }
  );
  if (!resp.ok) return errorResponse('Database error', 500);
  const data = await resp.json();
  const groupBuys = (data || []).map((m: any) => ({
    ...m.group_buys,
    product: m.group_buys?.products,
  }));
  return jsonResponse({ success: true, groupBuys });
}

// ===== MESSENGER =====
async function handleMessengerList(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { url, headers } = supabaseRest();

  // Get conversations where the user is a direct participant (participant1 or participant2)
  // OR a member via conversation_members (group conversations).
  // We do two queries and merge, deduplicating by conversation ID.

  // Query 1: direct participant conversations (1-on-1 + legacy group_buy)
  const directResp = await fetch(
    `${url}/rest/v1/conversations?select=id,type,is_group,name,participant1,participant2,group_buy_id,last_message,last_message_at,created_at&or=(participant1.eq.${user.id},participant2.eq.${user.id})&order=last_message_at.desc.nullslast`,
    { headers }
  );
  const directData = directResp.ok ? await directResp.json() : [];

  // Query 2: group conversations where user is a member via conversation_members
  const memberResp = await fetch(
    `${url}/rest/v1/conversation_members?select=conversations(id,type,is_group,name,participant1,participant2,group_buy_id,last_message,last_message_at,created_at)&user_id=eq.${user.id}`,
    { headers }
  );
  const memberData = memberResp.ok ? await memberResp.json() : [];
  const memberConvs = (memberData || []).map((m: any) => m.conversations).filter(Boolean);

  // Merge + deduplicate by ID
  const convMap = new Map<string, any>();
  for (const c of [...(directData || []), ...memberConvs]) {
    if (c && c.id && !convMap.has(c.id)) convMap.set(c.id, c);
  }
  // Sort by last_message_at desc
  const allConvs = Array.from(convMap.values()).sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  // Collect all "other user" IDs for direct conversations (for display name lookup)
  const otherUserIds = Array.from(new Set(
    allConvs
      .filter((c: any) => !c.is_group)
      .map((c: any) => c.participant1 === user.id ? c.participant2 : c.participant1)
      .filter(Boolean)
  ));

  // Batch-fetch display info for other users
  const userMap: Record<string, { email?: string; name?: string; image?: string }> = {};
  if (otherUserIds.length) {
    const sellersResp = await fetch(
      `${url}/rest/v1/sellers?select=id,business_name,profile_image,email&id=in.(${otherUserIds.join(',')})`,
      { headers }
    );
    if (sellersResp.ok) {
      const sellers = await sellersResp.json();
      for (const s of sellers) {
        userMap[s.id] = { name: s.business_name, image: s.profile_image, email: s.email };
      }
    }
    const missingIds = otherUserIds.filter((id: string) => !userMap[id]);
    for (const id of missingIds) {
      try {
        const uResp = await fetch(`${url}/auth/v1/admin/users/${id}`, {
          headers: { 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` },
        });
        if (uResp.ok) {
          const u = await uResp.json();
          userMap[id] = { email: u.email, name: u.email?.split('@')[0] };
        }
      } catch {}
    }
  }

  // For group conversations, also count members + get member count for display
  const groupConvIds = allConvs.filter((c: any) => c.is_group).map((c: any) => c.id);
  let memberCountMap: Record<string, number> = {};
  if (groupConvIds.length) {
    const countsResp = await fetch(
      `${url}/rest/v1/conversation_members?select=conversation_id&conversation_id=in.(${groupConvIds.join(',')})`,
      { headers }
    );
    if (countsResp.ok) {
      const counts = await countsResp.json();
      for (const c of counts) {
        memberCountMap[c.conversation_id] = (memberCountMap[c.conversation_id] || 0) + 1;
      }
    }
  }

  const conversations = allConvs.map((c: any) => {
    if (c.is_group) {
      // Group conversation — use the conversation's name, show member count
      return {
        id: c.id,
        type: c.type,
        isGroup: true,
        name: c.name || 'Group Chat',
        groupBuyId: c.group_buy_id,
        lastMessage: c.last_message || '',
        lastMessageAt: c.last_message_at,
        memberCount: memberCountMap[c.id] || 2,
        // For backward compat, still include otherUserId/Name (first participant)
        otherUserId: c.participant1 === user.id ? c.participant2 : c.participant1,
        otherUserName: c.name || 'Group Chat',
        otherUserImage: '',
      };
    }
    // Direct (1-on-1) conversation
    const otherId = c.participant1 === user.id ? c.participant2 : c.participant1;
    const info = userMap[otherId] || {};
    return {
      id: c.id,
      type: c.type,
      isGroup: false,
      groupBuyId: c.group_buy_id,
      lastMessage: c.last_message || '',
      lastMessageAt: c.last_message_at,
      otherUserId: otherId,
      otherUserEmail: info.email,
      otherUserName: info.name || info.email || 'User',
      otherUserImage: info.image || '',
    };
  });

  return jsonResponse({ success: true, conversations });
}

/**
 * Verify that a user has access to a conversation.
 * Checks BOTH:
 *   1. Direct participant (participant1 or participant2) — for 1-on-1 convs
 *   2. conversation_members table — for group conversations
 * Returns the conversation row if authorized, null otherwise.
 */
async function verifyConversationAccess(conversationId: string, userId: string): Promise<any | null> {
  // Check direct participant
  const convs = await supabaseSelect('conversations',
    'id,participant1,participant2,is_group,name,group_buy_id',
    { id: `eq.${conversationId}` }, { limit: 1 });
  if (!convs.length) return null;
  const conv: any = convs[0];
  if (conv.participant1 === userId || conv.participant2 === userId) return conv;

  // Check conversation_members (group conversations)
  const members = await supabaseSelect('conversation_members', 'id',
    { conversation_id: `eq.${conversationId}`, user_id: `eq.${userId}` }, { limit: 1 });
  if (members.length) return conv;

  return null;
}

async function handleMessengerMessages(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { conversationId } = body;
  if (!conversationId) return errorResponse('conversationId required', 400);

  const conv = await verifyConversationAccess(conversationId, user.id);
  if (!conv) return errorResponse('Not authorized', 403);

  const messages = await supabaseSelect('messages',
    'id,conversation_id,sender_id,encrypted_content,iv,created_at',
    { conversation_id: `eq.${conversationId}` },
    { order: 'created_at', limit: 100 });

  return jsonResponse({
    success: true,
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      encryptedContent: m.encrypted_content,
      iv: m.iv,
      createdAt: m.created_at,
    })),
  });
}

async function handleMessengerSend(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { conversationId, encryptedContent, iv } = body;
  if (!conversationId || !encryptedContent || !iv) {
    return errorResponse('Missing fields', 400);
  }

  const conv = await verifyConversationAccess(conversationId, user.id);
  if (!conv) return errorResponse('Not authorized', 403);

  const message = await supabaseInsert('messages', {
    conversation_id: conversationId,
    sender_id: user.id,
    encrypted_content: encryptedContent,
    iv: iv,
  });
  if (!message) return errorResponse('Failed to send', 500);

  // Update conversation last_message
  await supabaseUpdate('conversations',
    { last_message: '[Encrypted message]', last_message_at: new Date().toISOString() },
    { id: `eq.${conversationId}` }
  );

  // Return the message in camelCase format (matching handleMessengerMessages)
  // so the frontend can decrypt it immediately.
  return jsonResponse({
    success: true,
    message: {
      id: (message as any).id,
      conversationId: (message as any).conversation_id,
      senderId: (message as any).sender_id,
      encryptedContent: (message as any).encrypted_content,
      iv: (message as any).iv,
      createdAt: (message as any).created_at,
    },
  });
}

async function handleMessengerCreate(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { otherUserId, type, groupBuyId } = body;
  if (!otherUserId) return errorResponse('otherUserId required', 400);

  // Try to find existing conversation between these two users
  // (same type, same group_buy_id if provided)
  const { url, headers } = supabaseRest();
  const filters = groupBuyId
    ? `&group_buy_id=eq.${groupBuyId}`
    : `&group_buy_id=is.null`;
  const typeFilter = `&type=eq.${type || 'direct'}`;

  // Check both directions
  const findResp = await fetch(
    `${url}/rest/v1/conversations?select=*&or=(and(participant1.eq.${user.id},participant2.eq.${otherUserId}),and(participant1.eq.${otherUserId},participant2.eq.${user.id}))${filters}${typeFilter}&limit=1`,
    { headers }
  );
  if (findResp.ok) {
    const existing = await findResp.json();
    if (existing.length) return jsonResponse({ success: true, conversation: existing[0] });
  }

  // Create new conversation
  const conv = await supabaseInsert('conversations', {
    type: type || 'direct',
    participant1: user.id,
    participant2: otherUserId,
    group_buy_id: groupBuyId || null,
  });
  if (!conv) return errorResponse('Create failed', 500);
  return jsonResponse({ success: true, conversation: conv });
}

/**
 * Get the count of UNREAD messages for the user.
 * A message is "unread" if:
 *   - It was sent by someone else (sender_id != user.id)
 *   - read_at is NULL
 *   - It's in a conversation the user has access to (direct or group member)
 *
 * This is used for the messenger badge in the mobile nav and sidebar.
 */
async function handleMessengerUnread(user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { url, headers } = supabaseRest();

  // Get all conversation IDs the user has access to (direct + group member)
  const [directResp, memberResp] = await Promise.all([
    fetch(`${url}/rest/v1/conversations?select=id&or=(participant1.eq.${user.id},participant2.eq.${user.id})`, { headers }),
    fetch(`${url}/rest/v1/conversation_members?select=conversation_id&user_id=eq.${user.id}`, { headers }),
  ]);

  const directConvs = directResp.ok ? await directResp.json() : [];
  const memberConvs = memberResp.ok ? await memberResp.json() : [];

  const convIds = Array.from(new Set([
    ...(directConvs || []).map((c: any) => c.id),
    ...(memberConvs || []).map((m: any) => m.conversation_id),
  ])).filter(Boolean);

  if (convIds.length === 0) return jsonResponse({ success: true, count: 0 });

  // Count unread messages (sender_id != user.id, read_at is null)
  const unreadResp = await fetch(
    `${url}/rest/v1/messages?select=id&conversation_id=in.(${convIds.join(',')})&sender_id=neq.${user.id}&read_at=is.null`,
    { headers }
  );
  if (!unreadResp.ok) return jsonResponse({ success: true, count: 0 });
  const unread = await unreadResp.json();
  return jsonResponse({ success: true, count: (unread || []).length });
}

// ===== PERSONALIZATION (pgvector) =====
// These ops power the personalized feed. The /api/recommend route calls them
// to find products similar to what a user has viewed/liked/saved.

/**
 * Find products similar to the user's engagement history using pgvector.
 *
 * 1. Get the user's engaged product IDs (views + wishlist + reviews)
 * 2. Get the embeddings for those products
 * 3. Find similar products via cosine similarity (embedding <=> embedding)
 * 4. Exclude products the user has already engaged with
 * 5. Return the similar product IDs, ranked by similarity
 *
 * This is REAL personalization — "users who viewed X also viewed Y" but
 * powered by semantic similarity, not just co-occurrence.
 */
async function handlePgvectorSimilar(body: any, user: any) {
  // SECURITY FIX: Use the authenticated user's ID, NOT body.userId.
  // Previously, any user could pass another user's ID and see their
  // browsing history, wishlist, and reviews (PII leak).
  if (!user) return errorResponse('Authentication required', 401);
  const userId = user.id; // ALWAYS use the session user
  const safeUserId = encodeURIComponent(userId);
  const safeLimit = Math.min(Number(body.limit) || 20, 50);

  const { url, headers } = supabaseRest();

  try {
    // Step 1: Get the user's engaged product IDs
    const [viewsResp, wishlistResp, reviewsResp] = await Promise.all([
      fetch(`${url}/rest/v1/product_view_log?select=product_id&user_id=eq.${safeUserId}`, { headers }),
      fetch(`${url}/rest/v1/buyers_wishlist?select=product_id&user_id=eq.${safeUserId}`, { headers }),
      fetch(`${url}/rest/v1/buyers_reviews?select=product_id&user_id=eq.${safeUserId}`, { headers }),
    ]);

    const [views, wishlist, reviews] = await Promise.all([
      viewsResp.json(), wishlistResp.json(), reviewsResp.json(),
    ]);

    const engagedIds = new Set<number>();
    [...(views || []), ...(wishlist || []), ...(reviews || [])].forEach((r: any) => {
      if (r.product_id) engagedIds.add(Number(r.product_id));
    });

    if (engagedIds.size === 0) {
      // No history — can't do similarity search
      return jsonResponse({ success: true, productIds: [], source: 'no-history' });
    }

    // Step 2: Get embeddings for the user's engaged products (max 10 for speed)
    const engagedIdArr = Array.from(engagedIds).slice(0, 10);
    const engagedIdsFilter = engagedIdArr.join(',');
    const embeddingsResp = await fetch(
      `${url}/rest/v1/product_embeddings?select=product_id,embedding&product_id=in.(${engagedIdsFilter})&limit=10`,
      { headers }
    );
    if (!embeddingsResp.ok) return errorResponse('Embeddings fetch failed', 500);
    const embeddings = await embeddingsResp.json();
    if (!embeddings || embeddings.length === 0) {
      return jsonResponse({ success: true, productIds: [], source: 'no-embeddings' });
    }

    // Step 3: For each engaged embedding, find similar products via pgvector.
    // We can't do this via REST API directly (PostgREST doesn't support <=> operator
    // in WHERE clauses without a stored function). So we use an RPC function.
    //
    // We'll call a Postgres function 'match_products' that takes an embedding
    // and returns similar product IDs. If the function doesn't exist, we fall back
    // to returning the engaged products' categories' other products.
    //
    // For now, let's use a simpler approach: fetch ALL embeddings and compute
    // similarity in the edge function (Deno). This is fine for ~50 products.
    const allEmbeddingsResp = await fetch(
      `${url}/rest/v1/product_embeddings?select=product_id,embedding&limit=200`,
      { headers }
    );
    if (!allEmbeddingsResp.ok) return errorResponse('All embeddings fetch failed', 500);
    const allEmbeddings = await allEmbeddingsResp.json();

    // Compute average similarity across all engaged embeddings
    const scored: Array<{ id: number; score: number }> = [];
    for (const candidate of allEmbeddings) {
      if (engagedIds.has(Number(candidate.product_id))) continue;
      let totalSim = 0;
      let count = 0;
      for (const eng of embeddings) {
        const sim = cosineSimilarity(eng.embedding, candidate.embedding);
        totalSim += sim;
        count++;
      }
      if (count > 0) {
        scored.push({ id: Number(candidate.product_id), score: totalSim / count });
      }
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const topIds = scored.slice(0, safeLimit).map(s => String(s.id));

    return jsonResponse({
      success: true,
      productIds: topIds,
      source: 'pgvector-similarity',
      debug: { engagedCount: engagedIds.size, candidateCount: scored.length },
    });
  } catch (err) {
    console.error('pgvector_similar error:', err);
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

/**
 * Batch fetch products by IDs — used by /api/recommend to hydrate product IDs
 * returned by Gorse or pgvector into full product objects.
 */
async function handleProductsByIds(body: any) {
  const { ids } = body;
  if (!Array.isArray(ids) || !ids.length) return errorResponse('ids array required', 400);

  const numericIds = ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
  if (!numericIds.length) return jsonResponse({ success: true, products: [] });

  const { url, headers } = supabaseRest();
  const idsFilter = numericIds.slice(0, 100).join(',');

  try {
    const resp = await fetch(
      `${url}/rest/v1/products?select=*,sellers!products_seller_id_fkey(id,business_name,profile_image,slug)&id=in.(${idsFilter})`,
      { headers }
    );
    if (!resp.ok) return errorResponse('Database error', 500);
    const products = await resp.json();

    // Flatten seller data
    const result = (products || []).map((p: any) => ({
      ...p,
      seller_id: p.seller_id,
      seller_name: p.sellers?.business_name || 'Seller',
      seller_image: p.sellers?.profile_image || '',
      seller_slug: p.sellers?.slug || '',
      seller: p.sellers ? {
        id: p.sellers.id,
        business_name: p.sellers.business_name,
        profile_image: p.sellers.profile_image,
        slug: p.sellers.slug,
      } : null,
    }));

    return jsonResponse({ success: true, products: result });
  } catch (err) {
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

/**
 * Compute cosine similarity between two vectors (arrays of numbers).
 * pgvector stores embeddings as arrays; we compute 1 - cosine_distance.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  // Ensure both are arrays of numbers (pgvector may return a string)
  const arrA = Array.isArray(a) ? a : (typeof a === 'string' ? parseEmbedding(a) : []);
  const arrB = Array.isArray(b) ? b : (typeof b === 'string' ? parseEmbedding(b) : []);
  if (!arrA.length || !arrB.length || arrA.length !== arrB.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < arrA.length; i++) {
    dot += arrA[i] * arrB[i];
    magA += arrA[i] * arrA[i];
    magB += arrB[i] * arrB[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Parse a pgvector embedding string like "[0.019,0.043,...]" into a number[].
 * PostgREST returns embeddings as strings, not arrays — we need to parse them.
 */
function parseEmbedding(s: string): number[] {
  if (!s) return [];
  try {
    // Remove brackets and split by comma
    const clean = s.replace(/^\[/, '').replace(/\]$/, '');
    return clean.split(',').map(x => parseFloat(x)).filter(x => !isNaN(x));
  } catch {
    return [];
  }
}

/**
 * Semantic search via pgvector.
 * Takes a query embedding (generated by NVIDIA on the Next.js side) and
 * returns product IDs ranked by cosine similarity.
 *
 * This is the AI-powered search that understands intent, misspellings, and
 * descriptions — NOT pattern matching.
 */
async function handlePgvectorSearch(body: any) {
  const { embedding, limit } = body;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return errorResponse('embedding array required', 400);
  }
  const safeLimit = Math.min(Number(limit) || 20, 50);

  const { url, headers } = supabaseRest();

  try {
    // Fetch all product embeddings (we compute similarity in Deno because
    // PostgREST doesn't support the <=> operator directly in WHERE clauses).
    // For ~50 products this is fast. For larger catalogs, we'd use an RPC.
    const embeddingsResp = await fetch(
      `${url}/rest/v1/product_embeddings?select=product_id,embedding&limit=200`,
      { headers }
    );
    if (!embeddingsResp.ok) return errorResponse('Embeddings fetch failed', 500);
    const allEmbeddings = await embeddingsResp.json();

    // Compute cosine similarity between the query embedding and each product embedding
    const scored: Array<{ id: string; score: number }> = [];
    for (const candidate of allEmbeddings) {
      const sim = cosineSimilarity(embedding, candidate.embedding);
      scored.push({ id: String(candidate.product_id), score: sim });
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, safeLimit);

    return jsonResponse({
      success: true,
      results: topResults,
      source: 'pgvector-semantic-search',
    });
  } catch (err) {
    console.error('pgvector_search error:', err);
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

// ===== FOLLOWER NOTIFICATIONS =====
/**
 * Notify all followers of a seller that they added a new product.
 * Called by /api/seller-products after a successful product creation.
 * This is a public op (no auth required) — it's called server-to-server.
 */
async function handleNotifyFollowersProduct(body: any, user: any) {
  // SECURITY FIX: Require authentication. The sellerId must match the
  // authenticated user's ID — this prevents anyone from spamming
  // notifications to followers of any seller.
  if (!user) return errorResponse('Authentication required', 401);
  const { productId, productName } = body;
  const sellerId = user.id; // ALWAYS use the session user's ID
  if (!productId) return errorResponse('productId required', 400);

  try {
    // Get all followers of this seller
    const followers = await supabaseSelect('seller_follows', 'follower_id',
      { seller_id: `eq.${sellerId}` });
    if (!followers || followers.length === 0) {
      return jsonResponse({ success: true, notified: 0, message: 'No followers' });
    }

    // Get seller's display name
    let sellerName = 'A seller';
    const sellerRows = await supabaseSelect('sellers', 'business_name', { id: `eq.${sellerId}` }, { limit: 1 });
    if (sellerRows.length && (sellerRows[0] as any).business_name) {
      sellerName = (sellerRows[0] as any).business_name;
    }

    const notifData = {
      sellerId,
      sellerName,
      productId: Number(productId),
      productName: productName || 'a new product',
    };

    // Insert a notification for EACH follower (parallel)
    const notifPromises = (followers as any[]).map(f =>
      supabaseInsert('buyers_notifications', {
        user_id: f.follower_id,
        type: 'new_product',
        title: 'New product',
        message: `${sellerName} just added ${productName || 'a new product'}`,
        data: notifData,
        read: false,
      }).catch(() => {})
    );
    await Promise.all(notifPromises);

    return jsonResponse({ success: true, notified: followers.length });
  } catch (err) {
    console.error('notify_followers_product error:', err);
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

/**
 * Public seller lookup by slug.
 * Returns seller info + their products. No auth required (public storefronts).
 */
async function handleSellerBySlug(body: any) {
  const slug = String(body.slug || '').trim().toLowerCase();
  if (!slug) return errorResponse('slug required', 400);
  // Basic slug validation
  if (!/^[a-z0-9-]+$/.test(slug)) return errorResponse('Invalid slug format', 400);

  const { url, headers } = supabaseRest();

  try {
    // Fetch seller by slug
    const sellerResp = await fetch(
      `${url}/rest/v1/sellers?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { headers }
    );
    if (!sellerResp.ok) return errorResponse('Database error', 500);
    const sellerData = await sellerResp.json();
    if (!Array.isArray(sellerData) || sellerData.length === 0) {
      return errorResponse('Seller not found', 404);
    }
    const seller = sellerData[0];

    // Fetch the seller's products
    const productsResp = await fetch(
      `${url}/rest/v1/products?select=*&seller_id=eq.${seller.id}&order=created_at.desc&limit=100`,
      { headers }
    );
    const products = productsResp.ok ? await productsResp.json() : [];

    return jsonResponse({
      success: true,
      seller,
      products: Array.isArray(products) ? products : [],
    });
  } catch (err) {
    console.error('seller_by_slug error:', err);
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

// ============================================================================
// PAYMENTS — Paystack escrow, bank details, payouts
// ============================================================================
// All Paystack API calls happen HERE (in the Edge Function) using
// PAYSTACK_SECRET_KEY from Supabase Secrets. The frontend NEVER sees the key.
//
// Flow:
// 1. Buyer pays via Paystack → payment_verify confirms + creates escrow
// 2. Escrow holds funds for 3 days (release_at = now + 3 days)
// 3. After 3 days, escrow is released (via cron or manual)
// 4. Seller requests payout → Paystack Transfer API sends money to bank
// 5. Platform keeps 2.5% transaction fee
// ============================================================================

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const PAYSTACK_BASE = 'https://api.paystack.co';
const PLATFORM_FEE_PCT = 0.025;
const ESCROW_HOLD_DAYS = 3;

async function paystackFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!PAYSTACK_SECRET) throw new Error('Payment service not configured');
  const resp = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `Paystack error: ${resp.status}`);
  return data;
}

async function handlePaymentGetBanks(_body: any) {
  const data = await paystackFetch('/bank?country=nigeria&limit=100');
  return jsonResponse({ success: true, banks: data.data || [] });
}

async function handlePaymentGetBankDetails(_body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const data = await supabaseSelect('seller_bank_details', '*',
    { seller_id: `eq.${user.id}` }, { limit: 1 });
  return jsonResponse({ success: true, bankDetails: data[0] || null });
}

async function handlePaymentSaveBankDetails(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { accountName, accountNumber, bankCode, bankName } = body;
  if (!accountName || !accountNumber || !bankCode || !bankName) {
    return errorResponse('All bank details are required', 400);
  }

  let recipientCode = null;
  let isVerified = false;
  let verifyError = null;
  let transferError = null;

  if (!PAYSTACK_SECRET) {
    verifyError = 'Paystack secret key not configured';
  } else {
    // Step 1: Try to resolve the account via /bank/resolve
    // Note: This endpoint does NOT work for mobile money banks like PalmPay (code 999991).
    // For those, we rely on /transferrecipient as the verification method.
    try {
      const resolveData = await paystackFetch(
        `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
      );
      if (resolveData.status) isVerified = true;
    } catch (e) {
      verifyError = e.message || String(e);
      console.error('[Payment] Bank resolve failed:', verifyError);
    }

    // Step 2: Create a transfer recipient (needed for payouts).
    // This works for ALL banks that support transfers, including mobile money banks.
    // If this succeeds, the bank details are valid — mark as verified.
    try {
      const transferData = await paystackFetch('/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({
          type: 'nuban', name: accountName, account_number: accountNumber,
          bank_code: bankCode, currency: 'NGN',
        }),
      });
      recipientCode = transferData.data?.recipient_code || null;
      if (recipientCode) {
        isVerified = true;
      }
    } catch (e) {
      transferError = e.message || String(e);
      console.error('[Payment] Transfer recipient creation failed:', transferError);
    }

    // Combine errors for the response
    if (!isVerified) {
      if (verifyError && transferError) {
        verifyError = `Resolve: ${verifyError} | Transfer: ${transferError}`;
      } else if (transferError) {
        verifyError = transferError;
      }
      // If transferError is null but recipientCode was set, something weird happened
    }
  }

  // Upsert bank details
  const { url, headers } = supabaseRest();
  const resp = await fetch(`${url}/rest/v1/seller_bank_details`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      seller_id: user.id,
      account_name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      bank_name: bankName,
      recipient_code: recipientCode,
      is_verified: isVerified,
      updated_at: new Date().toISOString(),
    }),
  });
  const result = await resp.json();
  return jsonResponse({
    success: true,
    bankDetails: result[0],
    verified: isVerified,
    verifyError: isVerified ? null : verifyError,
  });
}

async function handlePaymentInitialize(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { orderId, email } = body;
  if (!orderId) return errorResponse('Order ID required', 400);

  // Fetch order
  const orders = await supabaseSelect('buyers_orders', '*',
    { id: `eq.${orderId}`, user_id: `eq.${user.id}` }, { limit: 1 });
  if (!orders.length) return errorResponse('Order not found', 404);
  const order = orders[0];
  if (order.status === 'paid') return errorResponse('Order already paid', 400);

  const reference = `CELLEX_${order.id}_${Date.now()}`;
  const initData = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: email || user.email || 'buyer@cellex.app',
      amount: Math.round(Number(order.total) * 100),
      currency: 'NGN',
      reference,
      callback_url: `https://eesha-learn.onrender.com/orders?payment_ref=${reference}`,
      metadata: {
        order_id: order.id,
        user_id: user.id,
        custom_fields: [
          { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
          { display_name: 'Items', variable_name: 'items', value: order.items_summary || '' },
        ],
      },
    }),
  });

  return jsonResponse({
    success: true,
    authorizationUrl: initData.data?.authorization_url,
    accessCode: initData.data?.access_code,
    reference,
  });
}

async function handlePaymentVerify(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);
  const { reference, orderId } = body;
  if (!reference) return errorResponse('Payment reference required', 400);

  // Fetch order
  const orders = await supabaseSelect('buyers_orders', '*',
    { id: `eq.${orderId}`, user_id: `eq.${user.id}` }, { limit: 1 });
  if (!orders.length) return errorResponse('Order not found', 404);
  const order = orders[0];
  if (order.status === 'paid') return jsonResponse({ success: true, status: 'already_verified' });

  // Verify with Paystack
  const paystackData = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!paystackData.status || paystackData.data.status !== 'success') {
    return errorResponse(`Payment status: ${paystackData.data?.status || 'failed'}`, 400);
  }

  // Check amount
  const expectedAmount = Math.round(Number(order.total) * 100);
  if (paystackData.data.amount !== expectedAmount) {
    console.error(`[Payment] AMOUNT MISMATCH: order=${order.id} expected=${expectedAmount} paid=${paystackData.data.amount}`);
    return errorResponse('Payment amount mismatch', 400);
  }

  // Mark order as paid
  await supabaseUpdate('buyers_orders', {
    status: 'paid', payment_ref: reference, paid_at: new Date().toISOString(),
  }, { id: `eq.${orderId}` });

  // Create payment record
  await supabaseInsert('payments', {
    order_id: orderId, user_id: user.id, reference, amount: Number(order.total),
    currency: 'NGN', channel: paystackData.data.channel || 'card', status: 'success',
    paystack_response: JSON.stringify(paystackData.data).slice(0, 5000),
  });

  // Create escrow records
  const orderItems = await supabaseSelect('buyers_order_items', '*', { order_id: `eq.${orderId}` });
  const releaseAt = new Date(Date.now() + ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let escrowCreated = 0;

  if (orderItems.length) {
    for (const item of orderItems) {
      const itemTotal = Number(item.total);
      const platformFee = Math.round(itemTotal * PLATFORM_FEE_PCT * 100) / 100;
      const sellerPayout = itemTotal - platformFee;

      await supabaseInsert('escrow', {
        order_id: orderId, seller_id: item.seller_id, buyer_id: user.id,
        amount: itemTotal, platform_fee: platformFee, seller_payout: sellerPayout,
        status: 'held', release_at: releaseAt,
      });
      escrowCreated++;

      await supabaseInsert('platform_revenue', {
        order_id: orderId, amount: platformFee, source: 'transaction_fee', status: 'collected',
      });
    }
  } else {
    const platformFee = Math.round(Number(order.total) * PLATFORM_FEE_PCT * 100) / 100;
    const sellerPayout = Number(order.total) - platformFee;
    await supabaseInsert('escrow', {
      order_id: orderId, seller_id: null, buyer_id: user.id,
      amount: Number(order.total), platform_fee: platformFee, seller_payout: sellerPayout,
      status: 'held', release_at: releaseAt,
    });
    escrowCreated++;
  }

  return jsonResponse({
    success: true, status: 'verified', orderId, amount: Number(order.total),
    reference, escrowCreated,
    message: `Payment verified. Funds held in escrow, released to seller on ${new Date(releaseAt).toLocaleDateString()}.`,
  });
}

async function handlePaymentGetEarnings(_body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);

  const escrowRecords = await supabaseSelect('escrow', '*',
    { seller_id: `eq.${user.id}` }, { order: 'created_at', limit: 100 });
  const payouts = await supabaseSelect('seller_payouts', '*',
    { seller_id: `eq.${user.id}` }, { order: 'created_at', limit: 50 });
  const bankDetails = await supabaseSelect('seller_bank_details', '*',
    { seller_id: `eq.${user.id}` }, { limit: 1 });

  const held = escrowRecords.filter(e => e.status === 'held');
  const released = escrowRecords.filter(e => e.status === 'released');
  const paidOut = escrowRecords.filter(e => e.status === 'paid_out');

  const totalHeld = held.reduce((s, e) => s + Number(e.seller_payout), 0);
  const totalReleased = released.reduce((s, e) => s + Number(e.seller_payout), 0);
  const totalPaidOut = paidOut.reduce((s, e) => s + Number(e.seller_payout), 0);

  return jsonResponse({
    success: true,
    earnings: {
      totalEarnings: totalHeld + totalReleased + totalPaidOut,
      heldBalance: totalHeld,
      availableBalance: totalReleased,
      paidOut: totalPaidOut,
    },
    bankDetails: bankDetails[0] || null,
    escrowRecords,
    payouts,
  });
}

async function handlePaymentRequestPayout(_body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);

  // Get released escrow
  const releasedEscrows = await supabaseSelect('escrow', '*',
    { seller_id: `eq.${user.id}`, status: `eq.released` });
  if (!releasedEscrows.length) return errorResponse('No available balance to withdraw', 400);

  // Get bank details
  const bankDetails = await supabaseSelect('seller_bank_details', '*',
    { seller_id: `eq.${user.id}` }, { limit: 1 });
  if (!bankDetails.length || !bankDetails[0].recipient_code) {
    return errorResponse('Please add your bank details first', 400);
  }

  const totalAmount = releasedEscrows.reduce((s, e) => s + Number(e.seller_payout), 0);
  if (totalAmount < 100) return errorResponse('Minimum payout is ₦100', 400);

  const reference = `PAYOUT_${user.id}_${Date.now()}`;
  const escrowIds = releasedEscrows.map(e => e.id);

  // Initiate transfer
  const transferData = await paystackFetch('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(totalAmount * 100),
      recipient: bankDetails[0].recipient_code,
      reason: 'Cellex seller payout',
      reference,
    }),
  });

  // Create payout record
  await supabaseInsert('seller_payouts', {
    seller_id: user.id, amount: totalAmount,
    status: transferData.data?.status === 'success' ? 'success' : 'pending',
    reference, transfer_code: transferData.data?.transfer_code || null,
    recipient_code: bankDetails[0].recipient_code, escrow_ids: escrowIds,
    processed_at: new Date().toISOString(),
  });

  // Mark escrow as paid out
  for (const esc of releasedEscrows) {
    await supabaseUpdate('escrow', {
      status: 'paid_out', paid_out_at: new Date().toISOString(), payout_reference: reference,
    }, { id: `eq.${esc.id}` });
  }

  return jsonResponse({
    success: true, amount: totalAmount, reference,
    status: transferData.data?.status || 'pending',
    message: `Payout of ₦${totalAmount.toLocaleString()} initiated. You'll receive it in 1-2 business days.`,
  });
}

// ===== CHECKOUT =====
/**
 * Create an order from the user's cart with SERVER-SIDE price verification.
 *
 * SECURITY:
 * - Fetches cart items from DB (never trusts client)
 * - Fetches REAL product prices from DB (never trusts client prices)
 * - Calculates total server-side
 * - Creates order + order items in DB
 * - Clears the cart
 */
async function handleCheckoutPlaceOrder(body: any, user: any) {
  if (!user) return errorResponse('Not authenticated', 401);

  const { shippingAddress } = body;
  if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone || !shippingAddress.address) {
    return errorResponse('Shipping address (name, phone, address) required', 400);
  }

  const { url, headers } = supabaseRest();

  try {
    // Step 1: Get user's cart items from DB
    const cartResp = await fetch(
      `${url}/rest/v1/cart_items?select=*,products(id,name,price,seller_id,image_url)&user_id=eq.${user.id}`,
      { headers }
    );
    if (!cartResp.ok) return errorResponse('Failed to fetch cart', 500);
    const cartItems = await cartResp.json();
    if (!cartItems || cartItems.length === 0) {
      return errorResponse('Cart is empty', 400);
    }

    // Step 2: Calculate total using REAL prices from DB
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of cartItems) {
      const product = item.products;
      if (!product) continue;

      const qty = Math.max(1, Math.min(99, item.quantity));
      const unitPrice = Number(product.price); // SERVER-SIDE price
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total: lineTotal,
        seller_id: product.seller_id,
      });
    }

    if (orderItems.length === 0) {
      return errorResponse('No valid items in cart', 400);
    }

    // Step 3: Calculate shipping + total
    const shipping = subtotal > 50000 ? 0 : 1500;
    const total = subtotal + shipping;

    // Step 4: Create the order
    const order = await supabaseInsert('buyers_orders', {
      user_id: user.id,
      total,
      status: 'pending',
      shipping_name: shippingAddress.name,
      shipping_phone: shippingAddress.phone,
      shipping_address: shippingAddress.address,
      shipping_city: shippingAddress.city || '',
      shipping_state: shippingAddress.state || '',
      items_count: orderItems.length,
      items_summary: orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', '),
    });

    if (!order) return errorResponse('Failed to create order', 500);

    // Step 5: Create order items
    for (const item of orderItems) {
      await supabaseInsert('buyers_order_items', {
        order_id: (order as any).id,
        ...item,
      });
    }

    // Step 6: Clear the cart
    await supabaseDelete('cart_items', { user_id: `eq.${user.id}` });

    return jsonResponse({
      success: true,
      order: {
        id: (order as any).id,
        total,
        status: 'pending',
        items_count: orderItems.length,
        items: orderItems,
      },
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return errorResponse(`Server error: ${String(err)}`, 500);
  }
}

// === AI Chat — proxies to NestJS backend which calls ZAI API ===
// Architecture: Frontend → Edge Function → Backend (NestJS) → ZAI API
// The edge function can't reach internal-api.z.ai directly (network restriction),
// so it proxies to the NestJS backend which CAN reach it.
async function handleAiChat(body: any, user: any) {
  if (!user) return errorResponse('Authentication required', 401);

  const { message, context, history, systemPrompt } = body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return errorResponse('Valid message required (max 2000 chars)', 400);
  }

  const NESTJS_URL = Deno.env.get('NESTJS_API_URL') || '';
  const INTERNAL_TOKEN = Deno.env.get('CELLEX_INTERNAL_TOKEN') || '';

  if (!NESTJS_URL || !INTERNAL_TOKEN) {
    return errorResponse('Backend service not configured', 500);
  }

  try {
    const resp = await fetch(`${NESTJS_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
        'X-User-Id': user.id,
        'X-User-Email': user.email || '',
      },
      body: JSON.stringify({ message, context, history, systemPrompt }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[AI Chat] Backend error:', resp.status, errText);
      return errorResponse(`AI service error (${resp.status}): ${errText.substring(0, 200)}`, 502);
    }

    const data = await resp.json();
    return jsonResponse(data);
  } catch (err) {
    console.error('[AI Chat] Error:', err);
    return errorResponse(`AI service unavailable: ${String(err).substring(0, 100)}`, 503);
  }
}

// === NVIDIA Embeddings — generates text embeddings for semantic search ===
// Uses NVIDIA's nv-embedqa-e5-v5 model (1024-dim) for semantic product search.
// The NVIDIA_API_KEY is stored in Supabase secrets.
async function handleGenerateEmbedding(body: any, user: any) {
  const { text, inputType } = body;
  if (!text || typeof text !== 'string' || text.length > 5000) {
    return errorResponse('Valid text required (max 5000 chars)', 400);
  }

  const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY') || '';
  if (!NVIDIA_API_KEY) {
    return errorResponse('Embedding service not configured', 500);
  }

  const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
  const MODEL = 'nvidia/nv-embedqa-e5-v5';

  try {
    const resp = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: [text],
        input_type: inputType || 'query',
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(5000), // 5s — must be fast for search
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[Embedding] NVIDIA error:', resp.status, errText.substring(0, 200));
      return errorResponse('Embedding service error', 502);
    }

    const data = await resp.json();
    const embedding = data.data?.[0]?.embedding || [];

    if (!embedding.length) {
      return errorResponse('Empty embedding returned', 502);
    }

    return jsonResponse({ success: true, embedding });
  } catch (err) {
    console.error('[Embedding] Error:', err);
    return errorResponse('Embedding service unavailable', 503);
  }
}
