/// <reference lib="deno.ns" />
// Cellex Payment Gateway — PalmPay manual transfer verification
// ====================================================================
// Customers transfer money to PalmPay, we verify by checking Gmail for
// the PalmPay transaction alert email that matches the order amount.
//
// API:
//   op=create_order    body: { buyerName, buyerEmail, buyerPhone?, itemsSummary, itemCount, total }
//                        → { orderId, expectedAmount, palmpayAccount, expiresAt }
//   op=confirm_sent    body: { orderId }
//                        → { success, message } (starts Gmail IMAP polling in background)
//   op=check_status    body: { orderId }
//                        → { status, expectedAmount, expiresAt }
//
// SECURITY:
//   - Gmail credentials are read from env vars, never returned or logged
//   - Rate limiting: 1 confirm_sent per order, 3 per IP per 10 min
//   - check_status only returns status, no email/transaction details
//   - IMAP connection uses TLS

import {
  corsHeaders, jsonResponse, errorResponse, getUser,
} from '../_shared/cors.ts';

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

const adminHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Amount suffix counter — generates unique decimal suffixes (0.01 - 0.99)
let suffixCounter = Math.floor(Math.random() * 99) + 1;

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CELLEX-${ts}${rand}`;
}

function generateUniqueAmount(baseAmount: number): number {
  // Add a unique decimal suffix (1-99 kobo) to disambiguate
  suffixCounter = (suffixCounter % 99) + 1;
  const base = Math.floor(baseAmount);
  const suffix = suffixCounter / 100; // 0.01 to 0.99
  return Math.round((base + suffix) * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const op = body.op || '';

    switch (op) {
      case 'create_order':   return await handleCreateOrder(req, body);
      case 'confirm_sent':   return await handleConfirmSent(req, body);
      case 'check_status':   return await handleCheckStatus(body);
      default:               return errorResponse(`Unknown op: ${op}`, 400);
    }
  } catch (error) {
    console.error('Payment error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---------------------------------------------------------------------------
// 1. CREATE ORDER
// ---------------------------------------------------------------------------
async function handleCreateOrder(req: Request, body: Record<string, unknown>): Promise<Response> {
  // Validate inputs
  const buyerName = (body.buyerName as string)?.trim();
  const buyerEmail = (body.buyerEmail as string)?.trim();
  const buyerPhone = (body.buyerPhone as string)?.trim() || null;
  const buyerBankName = (body.buyerBankName as string)?.trim() || null;
  const itemsSummary = (body.itemsSummary as string)?.trim();
  const itemCount = Number(body.itemCount) || 1;
  const total = Number(body.total);

  if (!buyerName || !buyerEmail || !itemsSummary || !total || total <= 0) {
    return errorResponse('Missing required fields: buyerName, buyerEmail, itemsSummary, total', 400);
  }

  // Get user if logged in (optional)
  const user = await getUser(req);

  // Generate unique order ID + amount
  const orderId = generateOrderId();
  const expectedAmount = generateUniqueAmount(total);

  // Insert into database
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      order_id: orderId,
      buyer_id: user?.id || null,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      buyer_bank_name: buyerBankName,
      expected_amount: expectedAmount,
      items_summary: itemsSummary,
      item_count: itemCount,
      status: 'pending',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return errorResponse(`Failed to create order: ${err}`, 500);
  }

  const order = (await resp.json())[0];

  return jsonResponse({
    success: true,
    orderId: order.order_id,
    expectedAmount: Number(order.expected_amount),
    palmpayAccount: {
      name: PALMPAY_ACCOUNT_NAME,
      number: PALMPAY_ACCOUNT_NUMBER,
      bank: PALMPAY_BANK,
    },
    expiresAt: order.expires_at,
    instructions: `Transfer exactly ₦${Number(order.expected_amount).toFixed(2)} to ${PALMPAY_ACCOUNT_NAME}, ${PALMPAY_ACCOUNT_NUMBER} (${PALMPAY_BANK}). The decimal amount (.${String(order.expected_amount).split('.')[1] || '00'}) is unique to your order — it helps us verify your payment automatically.`,
  });
}

// ---------------------------------------------------------------------------
// 2. CONFIRM SENT — triggers Gmail IMAP polling
// ---------------------------------------------------------------------------
async function handleConfirmSent(req: Request, body: Record<string, unknown>): Promise<Response> {
  const orderId = (body.orderId as string)?.trim();
  if (!orderId) return errorResponse('orderId is required', 400);

  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  // Rate limit check: max 1 confirm per order
  const existingConfirm = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_rate_limits?order_id=eq.${encodeURIComponent(orderId)}&select=id&limit=1`,
    { headers: adminHeaders }
  );
  const existing = await existingConfirm.json();
  if (existing?.length > 0) {
    return errorResponse('Verification already started for this order. Please wait.', 429);
  }

  // Rate limit check: max 3 per IP per 10 minutes
  const ipCheck = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_rate_limits?ip_address=eq.${encodeURIComponent(clientIP)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 10 * 60 * 1000).toISOString())}&select=id`,
    { headers: adminHeaders }
  );
  const ipEntries = await ipCheck.json();
  if (ipEntries?.length >= 3) {
    return errorResponse('Too many verification attempts. Please wait 10 minutes.', 429);
  }

  // Fetch the order
  const orderResp = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`,
    { headers: adminHeaders }
  );
  const orders = await orderResp.json();
  if (!orders?.length) return errorResponse('Order not found', 404);
  const order = orders[0];

  if (order.status !== 'pending') {
    return errorResponse(`Order is already ${order.status}`, 400);
  }

  // Check expiry
  if (new Date(order.expires_at) < new Date()) {
    // Mark as expired
    await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }),
    });
    return errorResponse('Order has expired. Please create a new order.', 410);
  }

  // Record the rate limit entry
  await fetch(`${SUPABASE_URL}/rest/v1/payment_rate_limits`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, ip_address: clientIP }),
  });

  // Update order status to awaiting_verification
  await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'awaiting_verification',
      verification_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  // Start Gmail IMAP polling in the background (don't await — return immediately)
  pollGmailForPayment(orderId, Number(order.expected_amount), order.buyer_name, order.buyer_bank_name || '').catch((e) => {
    console.error(`Gmail polling failed for order ${orderId}:`, e);
  });

  return jsonResponse({
    success: true,
    message: 'Verification started. We\'re checking for your payment. This usually takes 1-3 minutes.',
  });
}

// ---------------------------------------------------------------------------
// 3. Gmail IMAP polling — runs in background for up to 10 minutes
// ---------------------------------------------------------------------------
async function pollGmailForPayment(orderId: string, expectedAmount: number, buyerName: string, buyerBankName: string): Promise<void> {
  if (!GMAIL_EMAIL || !GMAIL_APP_PASSWORD) {
    console.warn('GMAIL_EMAIL or GMAIL_APP_PASSWORD not set — cannot verify payment');
    await updateOrderStatus(orderId, 'expired', null);
    return;
  }

  const maxAttempts = 20; // 20 attempts × 30s = 10 minutes
  const intervalMs = 30000; // 30 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const checkResp = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=status`,
      { headers: adminHeaders }
    );
    const checkData = await checkResp.json();
    if (!checkData?.length || checkData[0].status !== 'awaiting_verification') {
      return;
    }

    try {
      // Connect to Gmail via IMAP and fetch recent PalmPay emails
      const emails = await fetchRecentPalmPayEmails();
      
      if (emails.length > 0) {
        // Use AI to match the email against the order (name + bank + amount)
        const matched = await aiMatchPayment(emails, buyerName, buyerBankName, expectedAmount);
        
        if (matched) {
          // Check that this email hasn't been used for another order
          const usedCheck = await fetch(
            `${SUPABASE_URL}/rest/v1/payment_orders?matched_email_id=eq.${encodeURIComponent(matched.messageId)}&select=id`,
            { headers: adminHeaders }
          );
          const used = await usedCheck.json();
          if (used?.length > 0) {
            // Email already used — skip
          } else {
            // Mark email as read in Gmail
            await markEmailAsRead(matched.gmailMsgId);
            
            // Mark the order as matched
            await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
              method: 'PATCH',
              headers: { ...adminHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'matched',
                matched_at: new Date().toISOString(),
                matched_email_id: matched.messageId,
                matched_sender_name: matched.senderName,
                matched_amount: matched.amount,
                updated_at: new Date().toISOString(),
              }),
            });
            console.log(`✅ Payment matched for order ${orderId}: ${matched.senderName} sent ₦${matched.amount}`);
            return;
          }
        }
      }
    } catch (e) {
      console.error(`Gmail check attempt ${attempt + 1} failed:`, e);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  await updateOrderStatus(orderId, 'expired', null);
  console.log(`⏰ Order ${orderId} expired — no matching payment found`);
}

// ---------------------------------------------------------------------------
// AI-powered payment matching using Qwen2.5-72B
// ---------------------------------------------------------------------------
async function aiMatchPayment(emails: {msgId: string; rawContent: string}[], buyerName: string, buyerBankName: string, expectedAmount: number): Promise<{messageId: string; gmailMsgId: string; senderName: string; amount: number} | null> {
  if (!HF_TOKEN) {
    // Fallback: simple amount matching without AI
    for (const email of emails) {
      const amount = parseAmountFromEmail(email.rawContent);
      const sender = parseSenderFromEmail(email.rawContent);
      if (amount !== null && Math.abs(amount - expectedAmount) < 0.01) {
        return { messageId: `INBOX:${email.msgId}`, gmailMsgId: email.msgId, senderName: sender, amount };
      }
    }
    return null;
  }

  // Use AI to extract structured data from each email and match
  const prompt = `You are a payment verification assistant. I will give you PalmPay transaction alert emails and the expected payment details. Determine which email (if any) matches the payment.

Expected payment:
- Buyer name: "${buyerName}"
- Buyer bank: "${buyerBankName || 'any'}"
- Expected amount: ₦${expectedAmount.toFixed(2)} (must match exactly, including decimals)

Emails to check:
${emails.map((e, i) => `---EMAIL ${i + 1} (ID: ${e.msgId})---\n${e.rawContent.substring(0, 1000)}`).join('\n\n')}

Rules:
1. The amount must match ₦${expectedAmount.toFixed(2)} exactly
2. The sender name should be similar to "${buyerName}" (allow for minor variations)
3. The sender bank should match "${buyerBankName}" if provided
4. Only one email can match

Respond with JSON: {"match": true/false, "email_index": 1-based-index-or-null, "sender_name": "extracted-name", "amount": extracted-amount}`;

  try {
    const resp = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_INFERENCE_MODEL,
        messages: [
          { role: 'system', content: 'You are a payment verification assistant. Respond ONLY with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!resp.ok) {
      console.error('AI match failed:', resp.status);
      // Fallback to simple amount matching
      for (const email of emails) {
        const amount = parseAmountFromEmail(email.rawContent);
        const sender = parseSenderFromEmail(email.rawContent);
        if (amount !== null && Math.abs(amount - expectedAmount) < 0.01) {
          return { messageId: `INBOX:${email.msgId}`, gmailMsgId: email.msgId, senderName: sender, amount };
        }
      }
      return null;
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      if (result.match && result.email_index) {
        const emailIdx = result.email_index - 1;
        if (emailIdx >= 0 && emailIdx < emails.length) {
          const email = emails[emailIdx];
          return {
            messageId: `INBOX:${email.msgId}`,
            gmailMsgId: email.msgId,
            senderName: result.sender_name || 'Unknown',
            amount: result.amount || expectedAmount,
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error('AI match error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch recent PalmPay emails from Gmail (returns raw content for AI matching)
// ---------------------------------------------------------------------------
async function fetchRecentPalmPayEmails(): Promise<{msgId: string; rawContent: string}[]> {
  const IMAP_HOST = 'imap.gmail.com';
  const IMAP_PORT = 993;
  const conn = await Deno.connectTls({ hostname: IMAP_HOST, port: IMAP_PORT });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  await readUntil(conn, decoder, '\r\n');

  const tag = `A${Date.now()}`;
  await writeLine(conn, encoder, `${tag} LOGIN ${GMAIL_EMAIL} ${GMAIL_APP_PASSWORD}\r\n`);
  const loginResp = await readUntil(conn, decoder, `${tag} OK`);
  if (loginResp.includes('BAD') || loginResp.includes('NO')) {
    conn.close();
    throw new Error('Gmail login failed');
  }

  const folderTag = `${tag}1`;
  await writeLine(conn, encoder, `${folderTag} SELECT INBOX\r\n`);
  await readUntil(conn, decoder, `${folderTag} OK`);

  // Search for unread emails from PalmPay in last 24 hours
  const searchTag = `${tag}2`;
  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await writeLine(conn, encoder, `${searchTag} SEARCH UNSEEN FROM "palmpay" SINCE ${sinceDate}\r\n`);
  const searchResp = await readUntil(conn, decoder, `${searchTag} OK`);

  const searchMatch = searchResp.match(/\* SEARCH (.+)/);
  if (!searchMatch) {
    await logoutImap(conn, encoder, decoder, tag);
    return [];
  }

  const messageIds = searchMatch[1].trim().split(/\s+/);
  const emails: {msgId: string; rawContent: string}[] = [];

  // Fetch each email's content (headers + body)
  for (const msgId of messageIds.slice(0, 10)) { // Limit to 10 emails per check
    const fetchTag = `${tag}3${msgId}`;
    await writeLine(conn, encoder, `${fetchTag} FETCH ${msgId} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[TEXT])\r\n`);
    const fetchResp = await readUntil(conn, decoder, `${fetchTag} OK`);
    emails.push({ msgId, rawContent: fetchResp });
  }

  await logoutImap(conn, encoder, decoder, tag);
  return emails;
}

// ---------------------------------------------------------------------------
// Mark an email as read in Gmail
// ---------------------------------------------------------------------------
async function markEmailAsRead(msgId: string): Promise<void> {
  const conn = await Deno.connectTls({ hostname: 'imap.gmail.com', port: 993 });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  await readUntil(conn, decoder, '\r\n');
  const tag = `A${Date.now()}`;
  await writeLine(conn, encoder, `${tag} LOGIN ${GMAIL_EMAIL} ${GMAIL_APP_PASSWORD}\r\n`);
  await readUntil(conn, decoder, `${tag} OK`);

  const folderTag = `${tag}1`;
  await writeLine(conn, encoder, `${folderTag} SELECT INBOX\r\n`);
  await readUntil(conn, decoder, `${folderTag} OK`);

  const seenTag = `${tag}2`;
  await writeLine(conn, encoder, `${seenTag} STORE ${msgId} +FLAGS (\\Seen)\r\n`);
  await readUntil(conn, decoder, `${seenTag} OK`);

  await logoutImap(conn, encoder, decoder, tag);
}

  // No match found within 10 minutes — mark as expired
  await updateOrderStatus(orderId, 'expired', null);
  console.log(`⏰ Order ${orderId} expired — no matching payment found`);
}

// ---------------------------------------------------------------------------
// Gmail IMAP search — connects to Gmail, searches for PalmPay emails
// ---------------------------------------------------------------------------
async function searchGmailForPayment(expectedAmount: number): Promise<{ messageId: string; senderName: string; amount: number } | null> {
  // Connect to Gmail IMAP using Deno's TCP socket + TLS
  // We use a raw IMAP implementation since Deno doesn't have a built-in IMAP library
  
  const IMAP_HOST = 'imap.gmail.com';
  const IMAP_PORT = 993;

  // Connect via TLS
  const conn = await Deno.connectTls({ hostname: IMAP_HOST, port: IMAP_PORT });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Read until we see the server greeting
  await readUntil(conn, decoder, '\r\n');

  // Login
  const tag = `A${Date.now()}`;
  await writeLine(conn, encoder, `${tag} LOGIN ${GMAIL_EMAIL} ${GMAIL_APP_PASSWORD}\r\n`);
  const loginResp = await readUntil(conn, decoder, `${tag} OK`);
  if (loginResp.includes('BAD') || loginResp.includes('NO')) {
    conn.close();
    throw new Error('Gmail login failed');
  }

  // Select the "PalmPay" label/folder (or INBOX if no label)
  const folderTag = `${tag}1`;
  await writeLine(conn, encoder, `${folderTag} SELECT INBOX\r\n`);
  await readUntil(conn, decoder, `${folderTag} OK`);

  // Search for unread emails from PalmPay (last 24 hours)
  const searchTag = `${tag}2`;
  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '-');
  await writeLine(conn, encoder, `${searchTag} SEARCH UNSEEN FROM "palmpay" SINCE ${sinceDate}\r\n`);
  const searchResp = await readUntil(conn, decoder, `${searchTag} OK`);
  
  // Parse search results — format: * SEARCH 1 2 3 4
  const searchMatch = searchResp.match(/\* SEARCH (.+)/);
  if (!searchMatch) {
    // No unread PalmPay emails
    await logoutImap(conn, encoder, decoder, tag);
    return null;
  }

  const messageIds = searchMatch[1].trim().split(/\s+/);
  
  // Check each email for matching amount
  for (const msgId of messageIds) {
    const fetchTag = `${tag}3`;
    await writeLine(conn, encoder, `${fetchTag} FETCH ${msgId} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])\r\n`);
    const fetchResp = await readUntil(conn, decoder, `${fetchTag} OK`);
    
    // Parse the email for amount
    const amount = parseAmountFromEmail(fetchResp);
    const senderName = parseSenderFromEmail(fetchResp);
    
    if (amount !== null && Math.abs(amount - expectedAmount) < 0.01) {
      // Amount matches! Check that this email hasn't been used for another order
      const usedCheck = await fetch(
        `${SUPABASE_URL}/rest/v1/payment_orders?matched_email_id=not.is.null&select=matched_email_id`,
        { headers: adminHeaders }
      );
      const usedEmails = await usedCheck.json();
      const usedIds = new Set((usedEmails || []).map((o: Record<string, unknown>) => o.matched_email_id));
      
      // Generate a unique email ID (folder + message number)
      const emailUid = `INBOX:${msgId}`;
      
      if (!usedIds.has(emailUid)) {
        // Mark the email as read (SEEN)
        const seenTag = `${tag}4`;
        await writeLine(conn, encoder, `${seenTag} STORE ${msgId} +FLAGS (\Seen)\r\n`);
        await readUntil(conn, decoder, `${seenTag} OK`);
        
        await logoutImap(conn, encoder, decoder, tag);
        return { messageId: emailUid, senderName, amount };
      }
    }
  }

  await logoutImap(conn, encoder, decoder, tag);
  return null;
}

// Parse amount from PalmPay email body
function parseAmountFromEmail(emailText: string): number | null {
  // PalmPay emails typically contain: "Amount: ₦5,000.23" or "You received ₦5,000.23"
  const patterns = [
    /Amount:\s*₦?\s*([\d,]+\.?\d*)/i,
    /received\s*₦?\s*([\d,]+\.?\d*)/i,
    /₦\s*([\d,]+\.?\d*)/i,
    /NGN\s*([\d,]+\.?\d*)/i,
  ];
  
  for (const pattern of patterns) {
    const match = emailText.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) return Math.round(amount * 100) / 100;
    }
  }
  return null;
}

// Parse sender name from email
function parseSenderFromEmail(emailText: string): string {
  const fromMatch = emailText.match(/From:\s*(.+)/i);
  if (fromMatch) return fromMatch[1].trim().split('<')[0].trim().replace(/"/g, '');
  return 'Unknown';
}

// IMAP helper: read until we find a specific string
async function readUntil(conn: Deno.TlsConn, decoder: TextDecoder, until: string): Promise<string> {
  let buf = '';
  const chunk = new Uint8Array(4096);
  while (!buf.includes(until)) {
    const n = await conn.read(chunk);
    if (n === null) break;
    buf += decoder.decode(chunk.subarray(0, n));
  }
  return buf;
}

// IMAP helper: write a line
async function writeLine(conn: Deno.TlsConn, encoder: TextEncoder, text: string): Promise<void> {
  await conn.write(encoder.encode(text));
}

// IMAP helper: logout
async function logoutImap(conn: Deno.TlsConn, encoder: TextEncoder, decoder: TextDecoder, tag: string): Promise<void> {
  try {
    const logoutTag = `${tag}99`;
    await writeLine(conn, encoder, `${logoutTag} LOGOUT\r\n`);
    await readUntil(conn, decoder, logoutTag);
  } catch {}
  conn.close();
}

// ---------------------------------------------------------------------------
// 4. CHECK STATUS — returns only status, no sensitive details
// ---------------------------------------------------------------------------
async function handleCheckStatus(body: Record<string, unknown>): Promise<Response> {
  const orderId = (body.orderId as string)?.trim();
  if (!orderId) return errorResponse('orderId is required', 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=status,expected_amount,expires_at,created_at&limit=1`,
    { headers: adminHeaders }
  );
  const orders = await resp.json();
  if (!orders?.length) return errorResponse('Order not found', 404);
  const order = orders[0];

  return jsonResponse({
    success: true,
    status: order.status,
    expectedAmount: Number(order.expected_amount),
    expiresAt: order.expires_at,
    createdAt: order.created_at,
    // Only return matched info if matched (no email details)
    ...(order.status === 'matched' ? { message: 'Payment verified! Your order is confirmed.' } : {}),
    ...(order.status === 'expired' ? { message: 'Payment verification timed out. Please contact support.' } : {}),
    ...(order.status === 'awaiting_verification' ? { message: 'Checking for your payment...' } : {}),
    ...(order.status === 'pending' ? { message: 'Click "I\'ve sent it" after making the transfer.' } : {}),
  });
}

// ---------------------------------------------------------------------------
// Helper: update order status
// ---------------------------------------------------------------------------
async function updateOrderStatus(orderId: string, status: string, matchedEmailId: string | null): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (matchedEmailId) updates.matched_email_id = matchedEmailId;
  await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}
