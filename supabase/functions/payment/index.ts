/// <reference lib="deno.ns" />
// Cellex Payment Gateway — PalmPay verification (check_status triggers Gmail check)
import { corsHeaders, jsonResponse, errorResponse, getUser } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GMAIL_EMAIL = Deno.env.get('GMAIL_EMAIL') || '';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') || '';
const PALMPAY_ACCOUNT_NAME = Deno.env.get('PALMPAY_ACCOUNT_NAME') || 'Cellex Store';
const PALMPAY_ACCOUNT_NUMBER = Deno.env.get('PALMPAY_ACCOUNT_NUMBER') || '0000000000';
const PALMPAY_BANK = Deno.env.get('PALMPAY_BANK') || 'PalmPay';
const HF_ROUTER_URL = Deno.env.get('HF_ROUTER_URL') || 'https://router.huggingface.co/v1/chat/completions';
const HF_INFERENCE_MODEL = Deno.env.get('HF_INFERENCE_MODEL') || 'Qwen/Qwen2.5-72B-Instruct';
const HF_TOKEN = Deno.env.get('HF_TOKEN') || '';

const adminHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
let suffixCounter = Math.floor(Math.random() * 99) + 1;

function generateOrderId(): string {
  return `CELLEX-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2,6).toUpperCase()}`;
}

function generateUniqueAmount(base: number): number {
  suffixCounter = (suffixCounter % 99) + 1;
  return Math.round((Math.floor(base) + suffixCounter / 100) * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.op) {
      case 'create_order': return await handleCreateOrder(req, body);
      case 'confirm_sent': return await handleConfirmSent(req, body);
      case 'check_status': return await handleCheckStatus(body);
      default: return errorResponse(`Unknown op: ${body.op}`, 400);
    }
  } catch (error) {
    console.error('Payment error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

async function handleCreateOrder(req: Request, body: Record<string, unknown>): Promise<Response> {
  const buyerName = (body.buyerName as string)?.trim();
  const buyerEmail = (body.buyerEmail as string)?.trim();
  const buyerPhone = (body.buyerPhone as string)?.trim() || null;
  const buyerBankName = (body.buyerBankName as string)?.trim() || null;
  const itemsSummary = (body.itemsSummary as string)?.trim();
  const itemCount = Number(body.itemCount) || 1;
  const total = Number(body.total);
  if (!buyerName || !buyerEmail || !itemsSummary || !total || total <= 0)
    return errorResponse('Missing required fields', 400);
  const user = await getUser(req);
  const orderId = generateOrderId();
  const expectedAmount = generateUniqueAmount(total);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
    method: 'POST', headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ order_id: orderId, buyer_id: user?.id || null, buyer_email: buyerEmail, buyer_name: buyerName, buyer_phone: buyerPhone, buyer_bank_name: buyerBankName, expected_amount: expectedAmount, items_summary: itemsSummary, item_count: itemCount, status: 'pending' }),
  });
  if (!resp.ok) return errorResponse(`Failed to create order: ${await resp.text()}`, 500);
  const order = (await resp.json())[0];
  return jsonResponse({ success: true, orderId: order.order_id, expectedAmount: Number(order.expected_amount), palmpayAccount: { name: PALMPAY_ACCOUNT_NAME, number: PALMPAY_ACCOUNT_NUMBER, bank: PALMPAY_BANK }, expiresAt: order.expires_at, instructions: `Transfer exactly ₦${Number(order.expected_amount).toFixed(2)} to ${PALMPAY_ACCOUNT_NAME}, ${PALMPAY_ACCOUNT_NUMBER} (${PALMPAY_BANK}).` });
}

async function handleConfirmSent(req: Request, body: Record<string, unknown>): Promise<Response> {
  const orderId = (body.orderId as string)?.trim();
  if (!orderId) return errorResponse('orderId is required', 400);
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  // Rate limit: 1 per order
  const existing = await (await fetch(`${SUPABASE_URL}/rest/v1/payment_rate_limits?order_id=eq.${encodeURIComponent(orderId)}&select=id&limit=1`, { headers: adminHeaders })).json();
  if (existing?.length > 0) return errorResponse('Verification already started', 429);
  // Rate limit: 3 per IP per 10 min
  const ipEntries = await (await fetch(`${SUPABASE_URL}/rest/v1/payment_rate_limits?ip_address=eq.${encodeURIComponent(clientIP)}&created_at=gte.${encodeURIComponent(new Date(Date.now()-600000).toISOString())}&select=id`, { headers: adminHeaders })).json();
  if (ipEntries?.length >= 3) return errorResponse('Too many attempts. Wait 10 min.', 429);
  const orders = await (await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`, { headers: adminHeaders })).json();
  if (!orders?.length) return errorResponse('Order not found', 404);
  const order = orders[0];
  if (order.status !== 'pending') return errorResponse(`Order is ${order.status}`, 400);
  if (new Date(order.expires_at) < new Date()) {
    await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, { method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }) });
    return errorResponse('Order expired', 410);
  }
  await fetch(`${SUPABASE_URL}/rest/v1/payment_rate_limits`, { method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, ip_address: clientIP }) });
  await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, { method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'awaiting_verification', verification_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  return jsonResponse({ success: true, message: 'Verification started. We are checking for your payment.' });
}

// check_status: returns status AND triggers a single Gmail IMAP check
async function handleCheckStatus(body: Record<string, unknown>): Promise<Response> {
  const orderId = (body.orderId as string)?.trim();
  if (!orderId) return errorResponse('orderId is required', 400);
  const orders = await (await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`, { headers: adminHeaders })).json();
  if (!orders?.length) return errorResponse('Order not found', 404);
  const order = orders[0];

  // If awaiting verification, do a single Gmail check
  if (order.status === 'awaiting_verification') {
    try {
      const matched = await checkGmailOnce(Number(order.expected_amount), order.buyer_name, order.buyer_bank_name || '');
      if (matched) {
        // Check email not already used
        const used = await (await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?matched_email_id=eq.${encodeURIComponent(matched.messageId)}&select=id`, { headers: adminHeaders })).json();
        if (!used?.length) {
          await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
            method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'matched', matched_at: new Date().toISOString(), matched_email_id: matched.messageId, matched_sender_name: matched.senderName, matched_amount: matched.amount, updated_at: new Date().toISOString() }),
          });
          console.log(`✅ Matched order ${orderId}: ${matched.senderName} ₦${matched.amount}`);
          return jsonResponse({ success: true, status: 'matched', expectedAmount: Number(order.expected_amount), message: 'Payment verified! Your order is confirmed.' });
        }
      }
      // Check if expired (10 min since verification started)
      const startedAt = new Date(order.verification_started_at).getTime();
      if (Date.now() - startedAt > 600000) {
        await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }),
        });
        return jsonResponse({ success: true, status: 'expired', expectedAmount: Number(order.expected_amount), message: 'Verification timed out. Contact support.' });
      }
    } catch (e) {
      console.error(`Gmail check error for ${orderId}:`, e);
    }
  }

  const messages: Record<string, string> = {
    pending: 'Click "I\'ve sent it" after making the transfer.',
    awaiting_verification: 'Checking for your payment...',
    matched: 'Payment verified! Your order is confirmed.',
    expired: 'Verification timed out. Please contact support.',
    cancelled: 'Order cancelled.',
  };
  return jsonResponse({ success: true, status: order.status, expectedAmount: Number(order.expected_amount), expiresAt: order.expires_at, createdAt: order.created_at, message: messages[order.status] || '' });
}

// Single Gmail IMAP check — fetches recent unread PalmPay emails and matches via AI
async function checkGmailOnce(expectedAmount: number, buyerName: string, buyerBankName: string): Promise<{messageId: string; senderName: string; amount: number} | null> {
  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) return null;

  const conn = await Deno.connectTls({ hostname: 'imap.gmail.com', port: 993 });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  try {
    await readUntil(conn, decoder, '\r\n');
    const tag = `A${Date.now()}`;
    await writeLine(conn, encoder, `${tag} LOGIN ${GMAIL_EMAIL} ${GMAIL_APP_PASSWORD}\r\n`);
    const loginResp = await readUntil(conn, decoder, `${tag} OK`);
    if (loginResp.includes('BAD') || loginResp.includes('NO')) throw new Error('Gmail login failed');

    const t1 = `${tag}1`;
    await writeLine(conn, encoder, `${t1} SELECT INBOX\r\n`);
    await readUntil(conn, decoder, `${t1} OK`);

    // Search for unread PalmPay emails from last 24h
    const t2 = `${tag}2`;
    const since = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await writeLine(conn, encoder, `${t2} SEARCH UNSEEN FROM "palmpay" SINCE ${since}\r\n`);
    const searchResp = await readUntil(conn, decoder, `${t2} OK`);
    const searchMatch = searchResp.match(/\* SEARCH (.+)/);
    if (!searchMatch) { await logout(conn, encoder, decoder, tag); return null; }

    // Get the LAST 5 message IDs (most recent first)
    const allIds = searchMatch[1].trim().split(/\s+/);
    const recentIds = allIds.slice(-1); // last 5 (most recent)
    
    const emails: {msgId: string; rawContent: string}[] = [];
    for (const msgId of recentIds) {
      const t3 = `${tag}3${msgId}`;
      await writeLine(conn, encoder, `${t3} FETCH ${msgId} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])\r\n`);
      const fetchResp = await readUntil(conn, decoder, `${t3} OK`);
      emails.push({ msgId, rawContent: fetchResp });
    }
    await logout(conn, encoder, decoder, tag);

    if (emails.length === 0) return null;

    // Try AI matching first
    if (false) {
      const aiResult = await aiMatch(emails, buyerName, buyerBankName, expectedAmount);
      if (aiResult) {
        // Mark email as read
        await markRead(aiResult.gmailMsgId);
        return { messageId: aiResult.messageId, senderName: aiResult.senderName, amount: aiResult.amount };
      }
    }

    // Fallback: simple amount matching
    for (const email of emails) {
      const amount = parseAmount(email.rawContent);
      const sender = parseSender(email.rawContent);
      if (amount !== null && Math.abs(amount - expectedAmount) < 0.01) {
        await markRead(email.msgId);
        return { messageId: `INBOX:${email.msgId}`, senderName: sender, amount };
      }
    }
    return null;
  } finally {
    try { conn.close(); } catch {}
  }
}

async function aiMatch(emails: {msgId: string; rawContent: string}[], buyerName: string, buyerBankName: string, expectedAmount: number): Promise<{messageId: string; gmailMsgId: string; senderName: string; amount: number} | null> {
  const prompt = `You are a payment verification assistant. Match PalmPay transaction emails to an expected payment.

Expected payment:
- Buyer name: "${buyerName}"
- Buyer bank: "${buyerBankName || 'any'}"
- Expected amount: ₦${expectedAmount.toFixed(2)} (must match exactly)

Emails:
${emails.map((e, i) => `---EMAIL ${i+1} (ID:${e.msgId})---\n${e.rawContent.substring(0, 1500)}`).join('\n\n')}

Respond ONLY with JSON: {"match": true/false, "email_index": 1-based-or-null, "sender_name": "name", "amount": number}`;

  try {
    const resp = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: HF_INFERENCE_MODEL, messages: [{ role: 'system', content: 'Respond ONLY with valid JSON.' }, { role: 'user', content: prompt }], temperature: 0.1, max_tokens: 300 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const result = JSON.parse(m[0]);
      if (result.match && result.email_index) {
        const idx = result.email_index - 1;
        if (idx >= 0 && idx < emails.length) {
          return { messageId: `INBOX:${emails[idx].msgId}`, gmailMsgId: emails[idx].msgId, senderName: result.sender_name || 'Unknown', amount: result.amount || expectedAmount };
        }
      }
    }
    return null;
  } catch { return null; }
}

async function markRead(msgId: string): Promise<void> {
  try {
    const conn = await Deno.connectTls({ hostname: 'imap.gmail.com', port: 993 });
    const decoder = new TextDecoder(), encoder = new TextEncoder();
    await readUntil(conn, decoder, '\r\n');
    const tag = `B${Date.now()}`;
    await writeLine(conn, encoder, `${tag} LOGIN ${GMAIL_EMAIL} ${GMAIL_APP_PASSWORD}\r\n`);
    await readUntil(conn, decoder, `${tag} OK`);
    const t1 = `${tag}1`;
    await writeLine(conn, encoder, `${t1} SELECT INBOX\r\n`);
    await readUntil(conn, decoder, `${t1} OK`);
    const t2 = `${tag}2`;
    await writeLine(conn, encoder, `${t2} STORE ${msgId} +FLAGS (\\Seen)\r\n`);
    await readUntil(conn, decoder, `${t2} OK`);
    await logout(conn, encoder, decoder, tag);
  } catch {}
}

function parseAmount(text: string): number | null {
  const patterns = [/NGN\s*([\d,]+\.?\d*)/i, /₦\s*([\d,]+\.?\d*)/i, /Amount[:\s]*₦?\s*([\d,]+\.?\d*)/i, /received.*?₦?\s*([\d,]+\.?\d*)/i];
  for (const p of patterns) { const m = text.match(p); if (m) { const a = parseFloat(m[1].replace(/,/g, '')); if (!isNaN(a) && a > 0) return Math.round(a * 100) / 100; } }
  return null;
}

function parseSender(text: string): string {
  const m = text.match(/Sender[:\s]*<\/strong>\s*([^<\n]+)/i) || text.match(/From[:\s]*(.+)/i);
  return m ? m[1].trim() : 'Unknown';
}

async function readUntil(conn: Deno.TlsConn, decoder: TextDecoder, until: string): Promise<string> {
  let buf = '';
  const chunk = new Uint8Array(8192);
  const start = Date.now();
  while (!buf.includes(until)) {
    if (Date.now() - start > 25000) throw new Error('IMAP timeout');
    const n = await conn.read(chunk);
    if (n === null) break;
    buf += decoder.decode(chunk.subarray(0, n));
  }
  return buf;
}

async function writeLine(conn: Deno.TlsConn, encoder: TextEncoder, text: string): Promise<void> {
  await conn.write(encoder.encode(text));
}

async function logout(conn: Deno.TlsConn, encoder: TextEncoder, decoder: TextDecoder, tag: string): Promise<void> {
  try { const t = `${tag}99`; await writeLine(conn, encoder, `${t} LOGOUT\r\n`); await readUntil(conn, decoder, t); } catch {}
  try { conn.close(); } catch {}
}
