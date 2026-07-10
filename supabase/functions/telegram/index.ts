/// <reference lib="deno.ns" />
// Cellex Telegram Edge Function (Phase 4)
// -----------------------------------------
// Broadcasts flash sale alerts, new product notifications, and live shopping
// announcements to a Telegram channel + subscribed users.
//
// Also receives Telegram webhook updates for commands like /subscribe, /latest,
// /buy <id>, /join <id>.
//
// Env vars (all optional — if missing, broadcast silently skips):
//   TELEGRAM_BOT_TOKEN — from @BotFather
//   TELEGRAM_CHANNEL_ID — e.g. -1001234567890 (the channel where the bot is admin)
//
// API:
//   op=broadcast     body: { broadcastType, entityId?, message, imageUrl? }  → { success, recipients }
//   op=webhook       body: { update: <Telegram Update object> }              → { success }
//   op=set_webhook    body: { url }                                          → { success }
//   op=channel_info                                              → { success, channelTitle, subscriberCount }
//   op=subscribe     body: { chatId, username, userId? }                    → { success }  (called by webhook)
//   op=unsubscribe   body: { chatId }                                       → { success }
//   op=recent                                                  → { broadcasts: [...] } (public)

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
} from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHANNEL_ID = Deno.env.get('TELEGRAM_CHANNEL_ID') || '';
const BASE_URL = 'https://eeshaai-cellex-web.hf.space';

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
    const op = body.op || 'recent';

    // Public ops
    if (op === 'recent')        return await handleRecent();
    if (op === 'channel_info')  return await handleChannelInfo();
    if (op === 'webhook')       return await handleWebhook(body);

    // Internal broadcast — called by other edge functions with X-Internal-Call header
    if (op === 'broadcast') {
      // Optional: require internal header for safety
      const internal = req.headers.get('X-Internal-Call') || '';
      if (internal !== 'cellex-internal') {
        return errorResponse('Not authorized for broadcast', 403);
      }
      return await handleBroadcast(body);
    }

    // Auth-required (user linking their Telegram)
    if (op === 'subscribe' || op === 'unsubscribe') {
      const user = await getUser(req);
      // subscribe can be anonymous (chatId from Telegram), or auth (web user linking)
      return await (op === 'subscribe' ? handleSubscribe(user?.id || null, body) : handleUnsubscribe(body));
    }

    if (op === 'set_webhook') {
      const user = await getUser(req);
      if (!user) return errorResponse('Not authenticated', 401);
      return await handleSetWebhook(body);
    }

    return errorResponse(`Unknown op: ${op}`, 400);
  } catch (error) {
    console.error('telegram error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
async function handleBroadcast(body: Record<string, unknown>): Promise<Response> {
  const broadcastType = body.broadcastType as string;
  const message = body.message as string;
  if (!broadcastType || !message) return errorResponse('broadcastType and message required', 400);
  const imageUrl = body.imageUrl as string | undefined;
  const entityId = body.entityId as string | undefined;

  if (!TELEGRAM_BOT_TOKEN) {
    // Log only — don't fail the calling function
    console.warn('TELEGRAM_BOT_TOKEN not set, skipping broadcast');
    await logBroadcast(broadcastType, entityId, message, 0);
    return jsonResponse({ success: true, recipients: 0, skipped: 'no_token' });
  }

  let recipients = 0;

  // 1. Broadcast to channel
  if (TELEGRAM_CHANNEL_ID) {
    try {
      await sendTelegramMessage(TELEGRAM_CHANNEL_ID, message, imageUrl);
      recipients += 1; // channel counts as 1 recipient
    } catch (e) {
      console.error('Channel broadcast failed:', e);
    }
  }

  // 2. Broadcast to all subscribers
  const subsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_subscribers?select=telegram_chat_id`,
    { headers: adminHeaders }
  );
  const subs = await subsResp.json();
  for (const sub of (subs || [])) {
    try {
      await sendTelegramMessage(sub.telegram_chat_id, message, imageUrl);
      recipients += 1;
    } catch (e) {
      // Skip individual failures
      console.warn(`Failed to send to ${sub.telegram_chat_id}:`, e);
    }
  }

  await logBroadcast(broadcastType, entityId, message, recipients);
  return jsonResponse({ success: true, recipients });
}

async function sendTelegramMessage(chatId: string | number, text: string, imageUrl?: string): Promise<void> {
  if (imageUrl) {
    // Send photo with caption
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: imageUrl,
        caption: text,
        parse_mode: 'HTML',
      }),
    });
    if (!resp.ok) {
      // Fall back to text-only
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
    }
  } else {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Telegram API error ${resp.status}: ${errText}`);
    }
  }
}

async function logBroadcast(broadcastType: string, entityId: string | undefined, message: string, recipients: number): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/broadcast_log`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      broadcast_type: broadcastType,
      entity_id: entityId || null,
      message,
      recipients_count: recipients,
    }),
  }).catch(() => {});
}

async function handleWebhook(body: Record<string, unknown>): Promise<Response> {
  const update = body.update as Record<string, unknown>;
  if (!update) return errorResponse('update required', 400);

  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return jsonResponse({ success: true }); // Ignore non-message updates

  const chat = message.chat as Record<string, unknown>;
  const chatId = chat?.id as number;
  const text = (message.text as string || '').trim();
  const from = message.from as Record<string, unknown>;
  const username = from?.username as string | undefined;

  if (!chatId) return jsonResponse({ success: true });

  // Parse commands
  if (text === '/start' || text === '/subscribe') {
    // Subscribe the chat
    await fetch(`${SUPABASE_URL}/rest/v1/telegram_subscribers`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        telegram_chat_id: chatId,
        telegram_username: username || null,
      }),
    }).catch(() => {}); // UNIQUE constraint handles duplicate
    await sendTelegramMessage(chatId, '✅ You are now subscribed to Cellex alerts!\n\nCommands:\n/latest — see latest products\n/live — see active live sessions\n/groupbuys — see active group buys\n/unsubscribe — stop alerts\n\nVisit us at https://eeshaai-cellex-web.hf.space');
    return jsonResponse({ success: true });
  }

  if (text === '/unsubscribe') {
    await fetch(`${SUPABASE_URL}/rest/v1/telegram_subscribers?telegram_chat_id=eq.${chatId}`, {
      method: 'DELETE', headers: adminHeaders,
    });
    await sendTelegramMessage(chatId, 'You have been unsubscribed. Text /subscribe to re-subscribe anytime.');
    return jsonResponse({ success: true });
  }

  if (text === '/latest') {
    const products = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,price,image_url&order=created_at.desc&limit=5`, { headers: adminHeaders });
    const ps = await products.json();
    if (!ps?.length) {
      await sendTelegramMessage(chatId, 'No products available yet.');
    } else {
      const lines = ps.map((p: Record<string, unknown>) => `• <b>${escapeHtml(p.name as string)}</b> — $${Number(p.price).toFixed(2)}\n   ${BASE_URL}/Eesha buying folder/product.html?id=${p.id}`).join('\n\n');
      await sendTelegramMessage(chatId, `🆕 <b>Latest products on Cellex:</b>\n\n${lines}`);
    }
    return jsonResponse({ success: true });
  }

  if (text === '/live') {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/shop_live_sessions?status=eq.live&select=id,title,viewer_count,featured_product_id&order=started_at.desc&limit=5`, { headers: adminHeaders });
    const sessions = await resp.json();
    if (!sessions?.length) {
      await sendTelegramMessage(chatId, '🔴 No live sessions right now. Check back later!');
    } else {
      const lines = sessions.map((s: Record<string, unknown>) => `🔴 <b>${escapeHtml(s.title as string)}</b> (${s.viewer_count} viewers)\n   ${BASE_URL}/live-watch.html?id=${s.id}`).join('\n\n');
      await sendTelegramMessage(chatId, `🔴 <b>Live now on Cellex:</b>\n\n${lines}`);
    }
    return jsonResponse({ success: true });
  }

  if (text === '/groupbuys') {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/group_buys?status=eq.open&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*,products(id,name,price,image_url)&order=created_at.desc&limit=5`, { headers: adminHeaders });
    const gbs = await resp.json();
    if (!gbs?.length) {
      await sendTelegramMessage(chatId, 'No active group buys right now.');
    } else {
      const lines = gbs.map((gb: Record<string, unknown>) => {
        const p = gb.products as Record<string, unknown>;
        return `🛍️ <b>${escapeHtml(p?.name as string || 'Product')}</b> — ${gb.current_count}/${gb.target_count} joined (${gb.discount_pct}% off)\n   ${BASE_URL}/group-buy.html?id=${gb.id}`;
      }).join('\n\n');
      await sendTelegramMessage(chatId, `🛍️ <b>Active group buys:</b>\n\n${lines}`);
    }
    return jsonResponse({ success: true });
  }

  if (text.startsWith('/buy ')) {
    const id = text.replace('/buy ', '').trim();
    await sendTelegramMessage(chatId, `🛒 Buy this product: ${BASE_URL}/Eesha buying folder/product.html?id=${encodeURIComponent(id)}`);
    return jsonResponse({ success: true });
  }

  if (text.startsWith('/join ')) {
    const id = text.replace('/join ', '').trim();
    await sendTelegramMessage(chatId, `🛍️ Join this group buy: ${BASE_URL}/group-buy.html?id=${encodeURIComponent(id)}`);
    return jsonResponse({ success: true });
  }

  // Unknown command — send help
  if (text.startsWith('/')) {
    await sendTelegramMessage(chatId, 'Unknown command. Try /latest, /live, /groupbuys, /subscribe, /unsubscribe, /buy <id>, /join <id>');
  }
  return jsonResponse({ success: true });
}

async function handleSetWebhook(body: Record<string, unknown>): Promise<Response> {
  if (!TELEGRAM_BOT_TOKEN) return errorResponse('TELEGRAM_BOT_TOKEN env var not set', 500);
  const webhookUrl = body.url as string;
  if (!webhookUrl) return errorResponse('url required', 400);
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const data = await resp.json();
  if (!resp.ok) return errorResponse(`Telegram API error: ${JSON.stringify(data)}`, 500);
  return jsonResponse({ success: true, result: data });
}

async function handleChannelInfo(): Promise<Response> {
  const subsResp = await fetch(`${SUPABASE_URL}/rest/v1/telegram_subscribers?select=id`, { headers: adminHeaders });
  const subs = await subsResp.json();
  let channelInfo: Record<string, unknown> | null = null;
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${TELEGRAM_CHANNEL_ID}`);
      const data = await resp.json();
      if (data.ok) {
        channelInfo = {
          title: data.result.title,
          username: data.result.username,
          type: data.result.type,
        };
      }
    } catch {}
  }
  return jsonResponse({
    success: true,
    configured: !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_CHANNEL_ID,
    subscriberCount: (subs || []).length,
    channel: channelInfo,
  });
}

async function handleSubscribe(userId: string | null, body: Record<string, unknown>): Promise<Response> {
  const chatId = Number(body.chatId);
  if (!chatId) return errorResponse('chatId required', 400);
  await fetch(`${SUPABASE_URL}/rest/v1/telegram_subscribers`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      telegram_chat_id: chatId,
      telegram_username: body.username || null,
      user_id: userId,
    }),
  }).catch(() => {});
  return jsonResponse({ success: true });
}

async function handleUnsubscribe(body: Record<string, unknown>): Promise<Response> {
  const chatId = Number(body.chatId);
  if (!chatId) return errorResponse('chatId required', 400);
  await fetch(`${SUPABASE_URL}/rest/v1/telegram_subscribers?telegram_chat_id=eq.${chatId}`, {
    method: 'DELETE', headers: adminHeaders,
  });
  return jsonResponse({ success: true });
}

async function handleRecent(): Promise<Response> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/broadcast_log?select=*&order=created_at.desc&limit=20`,
    { headers: adminHeaders }
  );
  const broadcasts = await resp.json();
  return jsonResponse({ success: true, broadcasts: broadcasts || [] });
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
