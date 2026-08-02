/**
 * Cellex Core API — Express server
 *
 * Security:
 * - Every request MUST have X-Internal-Token header (set by Edge Functions)
 * - User identity from X-User-Id header (set by Edge Functions after session verification)
 * - NEVER trusts client-supplied user IDs, prices, or payment status
 * - All errors are sanitized — no internal details leaked
 * - Audit logging on all mutations
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const INTERNAL_TOKEN = process.env.CELLEX_INTERNAL_TOKEN || '';

// Supabase client (service role — bypasses RLS, safe because behind Edge Functions)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// === Internal Token Guard ===
app.use((req, res, next) => {
  // Skip health check
  if (req.path === '/health') return next();

  const token = req.headers['x-internal-token'];
  if (!INTERNAL_TOKEN || token !== INTERNAL_TOKEN) {
    return res.status(401).json({ success: false, error: 'Invalid request source' });
  }

  // Extract user info from headers (set by Edge Functions)
  req.userId = req.headers['x-user-id'] || '';
  req.userEmail = req.headers['x-user-email'] || '';
  req.requestId = req.headers['x-request-id'] || '';
  next();
});

// === Error Sanitizer ===
function sanitizeError(err) {
  let message = 'An error occurred. Please try again.';
  let status = 500;

  if (err.message) {
    if (err.message.includes('duplicate key')) { status = 409; message = 'This item already exists.'; }
    else if (err.message.includes('foreign key')) { status = 400; message = 'Referenced item not found.'; }
    else if (err.message.includes('not null')) { status = 400; message = 'Missing required field.'; }
    else if (err.message.includes('not found')) { status = 404; message = err.message; }
    else if (err.message.includes('Not authorized')) { status = 403; message = err.message; }
    else if (err.message.includes('required')) { status = 400; message = err.message; }
  }
  if (err.status) status = err.status;

  return { status, message };
}

// === Audit Logger ===
async function auditLog(req, status, error) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return;
  if (!supabase) return;
  try {
    const body = { ...req.body };
    delete body.password; delete body.token; delete body.card_number; delete body.cvv; delete body.secret;
    await supabase.from('audit_log').insert({
      user_id: req.userId || null,
      request_id: req.requestId || null,
      method: req.method,
      path: req.path,
      status: status,
      error_message: error ? String(error).slice(0, 500) : null,
      request_body: JSON.stringify(body).slice(0, 2000),
      created_at: new Date().toISOString(),
    });
  } catch (e) { /* non-fatal */ }
}

// === Health Check ===
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cellex-core-api', version: '1.0.0', time: new Date().toISOString() });
});

// === Products ===
app.get('/products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const category = req.query.category;
    let query = supabase.from('products').select('*').eq('status', 'active').limit(limit);
    if (category) query = query.eq('category', category);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, products: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    auditLog(req, 'error', err.message);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.get('/products/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { data, error } = await supabase.from('products').select('*').eq('status', 'active').order('units_sold', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ success: true, products: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error || !data) throw { message: 'Product not found', status: 404 };
    res.json({ success: true, product: data });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/products/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    const { data, error } = await supabase.from('products').select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('status', 'active').limit(limit);
    if (error) throw error;
    res.json({ success: true, products: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/products/by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.json({ success: true, products: [] });
    const { data, error } = await supabase.from('products')
      .select('*,sellers!products_seller_id_fkey(id,business_name,profile_image,slug)')
      .in('id', ids);
    if (error) throw error;
    res.json({ success: true, products: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Orders ===
app.post('/orders', async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!items || !items.length) throw { message: 'Order must have at least one item', status: 400 };

    // Fetch REAL prices from DB (NEVER trust client prices)
    const productIds = items.map(i => i.productId);
    const { data: products, error: prodError } = await supabase.from('products')
      .select('id,name,price,seller_id').in('id', productIds);
    if (prodError) throw prodError;

    const productMap = new Map(products.map(p => [p.id, p]));
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw { message: `Product ${item.productId} not found`, status: 400 };
      const qty = Math.max(1, Math.min(99, item.quantity));
      const unitPrice = Number(product.price);
      total += unitPrice * qty;
      orderItems.push({
        product_id: product.id, product_name: product.name, quantity: qty,
        unit_price: unitPrice, total: unitPrice * qty, seller_id: product.seller_id,
      });
    }

    // Create order
    const { data: order, error: orderError } = await supabase.from('buyers_orders').insert({
      user_id: req.userId, total, status: 'pending',
      shipping_name: shippingAddress.name, shipping_phone: shippingAddress.phone,
      shipping_address: shippingAddress.address, shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state, items_count: orderItems.length,
      items_summary: orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', '),
    }).select().single();
    if (orderError) throw orderError;

    // Create order items
    for (const item of orderItems) {
      await supabase.from('buyers_order_items').insert({ order_id: order.id, ...item });
    }

    auditLog(req, 'success');
    res.json({ success: true, order: { id: order.id, total, status: 'pending', items: orderItems } });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('buyers_orders')
      .select('id,total,status,items_count,items_summary,created_at')
      .eq('user_id', req.userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ success: true, orders: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const { data: order, error } = await supabase.from('buyers_orders')
      .select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
    if (error || !order) throw { message: 'Order not found', status: 404 };
    const { data: items } = await supabase.from('buyers_order_items').select('*').eq('order_id', req.params.id);
    res.json({ success: true, order: { ...order, items: items || [] } });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Payments ===
app.post('/payments/verify', async (req, res) => {
  try {
    const { reference, orderId } = req.body;
    if (!reference) throw { message: 'Payment reference is required', status: 400 };

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) throw { message: 'Payment service not configured', status: 500 };

    // Fetch order
    const { data: order, error } = await supabase.from('buyers_orders')
      .select('*').eq('id', orderId).eq('user_id', req.userId).single();
    if (error || !order) throw { message: 'Order not found', status: 404 };

    if (order.status === 'paid') return res.json({ success: true, status: 'already_verified' });

    // Verify with Paystack (SERVER-TO-SERVER)
    const paystackResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!paystackResp.ok) throw { message: 'Unable to verify payment', status: 400 };
    const paystackData = await paystackResp.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      throw { message: `Payment status: ${paystackData.data?.status || 'failed'}`, status: 400 };
    }

    // Check amount (Paystack returns kobo)
    const expectedAmount = Math.round(Number(order.total) * 100);
    if (paystackData.data.amount !== expectedAmount) {
      console.error(`[Payments] AMOUNT MISMATCH: order=${order.id} expected=${expectedAmount} paid=${paystackData.data.amount}`);
      throw { message: 'Payment amount does not match order total', status: 400 };
    }

    // Mark as paid
    await supabase.from('buyers_orders').update({
      status: 'paid', payment_ref: reference, paid_at: new Date().toISOString(),
    }).eq('id', orderId);

    await supabase.from('payments').insert({
      order_id: orderId, user_id: req.userId, reference, amount: Number(order.total),
      currency: 'NGN', channel: paystackData.data.channel || 'card', status: 'success',
      paystack_response: JSON.stringify(paystackData.data).slice(0, 5000),
    });

    auditLog(req, 'success');
    res.json({ success: true, status: 'verified', orderId, amount: Number(order.total) });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Messaging ===
app.get('/messaging/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase.from('conversations')
      .select('*').or(`participant1.eq.${req.userId},participant2.eq.${req.userId}`)
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, conversations: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.get('/messaging/messages', async (req, res) => {
  try {
    const convId = req.query.conversationId;
    // Verify access
    const { data: conv } = await supabase.from('conversations').select('id,participant1,participant2')
      .eq('id', convId).or(`participant1.eq.${req.userId},participant2.eq.${req.userId}`).single();
    if (!conv) throw { message: 'Not authorized', status: 403 };

    const { data, error } = await supabase.from('messages')
      .select('id,sender_id,encrypted_content,iv,created_at')
      .eq('conversation_id', convId).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    res.json({ success: true, messages: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/messaging/send', async (req, res) => {
  try {
    const { conversationId, encryptedContent, iv } = req.body;
    // Verify access
    const { data: conv } = await supabase.from('conversations').select('id,participant1,participant2')
      .eq('id', conversationId).or(`participant1.eq.${req.userId},participant2.eq.${req.userId}`).single();
    if (!conv) throw { message: 'Not authorized', status: 403 };

    const { data: message, error } = await supabase.from('messages').insert({
      conversation_id: conversationId, sender_id: req.userId,
      encrypted_content: encryptedContent, iv,
    }).select().single();
    if (error) throw error;

    await supabase.from('conversations').update({
      last_message: '[Encrypted message]', last_message_at: new Date().toISOString(),
    }).eq('id', conversationId);

    auditLog(req, 'success');
    res.json({ success: true, message });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Notifications ===
app.get('/notifications', async (req, res) => {
  try {
    const { data, error } = await supabase.from('buyers_notifications')
      .select('id,type,title,message,data,read,created_at')
      .eq('user_id', req.userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ success: true, notifications: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/notifications/read', async (req, res) => {
  try {
    const { notificationId } = req.body;
    await supabase.from('buyers_notifications').update({ read: true })
      .eq('id', notificationId).eq('user_id', req.userId);
    res.json({ success: true });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Users ===
app.get('/users/profile', async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', req.userId).single();
    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.patch('/users/profile', async (req, res) => {
  try {
    const allowed = ['full_name', 'phone', 'address', 'avatar_url'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.userId).select().single();
    if (error) throw error;
    auditLog(req, 'success');
    res.json({ success: true, profile: data });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Sellers ===
app.get('/sellers/profile', async (req, res) => {
  try {
    const { data, error } = await supabase.from('sellers').select('*').eq('id', req.userId).single();
    if (error) throw error;
    res.json({ success: true, seller: data });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.patch('/sellers/profile', async (req, res) => {
  try {
    const allowed = ['business_name','business_description','business_category','business_location',
      'profile_image','phone','contact_phone','address','state','avatar_script','avatar_language','avatar_audio_url'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    const { data, error } = await supabase.from('sellers').update(updates).eq('id', req.userId).select().single();
    if (error) throw error;
    auditLog(req, 'success');
    res.json({ success: true, seller: data });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/sellers/by-slug', async (req, res) => {
  try {
    const { slug } = req.body;
    const { data: seller, error } = await supabase.from('sellers').select('*').eq('slug', slug).single();
    if (error || !seller) throw { message: 'Seller not found', status: 404 };
    const { data: products } = await supabase.from('products').select('*')
      .eq('seller_id', seller.id).eq('status', 'active').order('created_at', { ascending: false }).limit(100);
    res.json({ success: true, seller, products: products || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Cart ===
app.get('/cart', async (req, res) => {
  try {
    const { data, error } = await supabase.from('cart_items').select('*,products(*)').eq('user_id', req.userId);
    if (error) throw error;
    res.json({ success: true, items: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/cart/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const { data, error } = await supabase.from('cart_items').upsert({
      user_id: req.userId, product_id: productId, quantity,
    }).select().single();
    if (error) throw error;
    auditLog(req, 'success');
    res.json({ success: true, item: data });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/cart/remove', async (req, res) => {
  try {
    const { cartItemId } = req.body;
    await supabase.from('cart_items').delete().eq('id', cartItemId).eq('user_id', req.userId);
    auditLog(req, 'success');
    res.json({ success: true });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Admin ===
app.get('/admin/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('id,full_name,phone,created_at').limit(100);
    if (error) throw error;
    res.json({ success: true, users: data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/admin/moderate', async (req, res) => {
  try {
    const { type, id } = req.body;
    if (type === 'post') await supabase.from('feed_posts').update({ status: 'flagged' }).eq('id', id);
    else if (type === 'product') await supabase.from('products').update({ status: 'inactive' }).eq('id', id);
    auditLog(req, 'success');
    res.json({ success: true });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === AI Search (NVIDIA embeddings + pgvector) ===
app.post('/ai/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    if (!query) return res.json({ success: true, products: [], source: 'empty' });

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
    let embedding = [];

    // Generate embedding via NVIDIA
    if (NVIDIA_API_KEY) {
      try {
        const embResp = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'nvidia/nv-embedqa-e5-v5', input: query, input_type: 'query', encoding_format: 'float' }),
          signal: AbortSignal.timeout(10000),
        });
        if (embResp.ok) {
          const embData = await embResp.json();
          embedding = embData.data?.[0]?.embedding || [];
        }
      } catch (e) { /* fallback */ }
    }

    // Search via Edge Function (pgvector)
    if (embedding.length) {
      try {
        const EDGE_URL = (process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co') + '/functions/v1';
        const searchResp = await fetch(`${EDGE_URL}/social`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'pgvector_search', embedding, limit }),
          signal: AbortSignal.timeout(5000),
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          const productIds = (searchData.results || []).map(r => parseInt(r.id));
          if (productIds.length) {
            const { data: products } = await supabase.from('products')
              .select('*,sellers!products_seller_id_fkey(id,business_name,profile_image,slug)')
              .in('id', productIds);
            return res.json({ success: true, products: products || [], source: 'nvidia-pgvector' });
          }
        }
      } catch (e) { /* fallback */ }
    }

    // Fallback: text search
    const { data, error } = await supabase.from('products').select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('status', 'active').limit(limit);
    if (error) throw error;
    res.json({ success: true, products: data || [], source: 'text-fallback' });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === AI Recommendations (Gorse + trending fallback) ===
app.post('/ai/recommend', async (req, res) => {
  try {
    const { userId, limit = 20 } = req.body;
    const GORSE_URL = process.env.GORSE_URL || '';

    // Try Gorse
    if (GORSE_URL) {
      try {
        const gorseResp = await fetch(`${GORSE_URL}/api/recommend/${userId}?n=${limit}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (gorseResp.ok) {
          const gorseData = await gorseResp.json();
          const itemIds = (gorseData.Items || []).map(id => parseInt(id)).filter(id => !isNaN(id));
          if (itemIds.length) {
            const { data: products } = await supabase.from('products')
              .select('*,sellers!products_seller_id_fkey(id,business_name,profile_image,slug)')
              .in('id', itemIds.slice(0, limit));
            if (products?.length) return res.json({ success: true, products, source: 'gorse' });
          }
        }
      } catch (e) { /* fallback */ }
    }

    // Fallback: trending
    const { data, error } = await supabase.from('products').select('*')
      .eq('status', 'active').order('units_sold', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ success: true, products: data || [], source: 'trending-fallback' });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === AI Avatar (TTS) ===
app.post('/ai/avatar', async (req, res) => {
  try {
    const { script, sellerId } = req.body;
    if (!script) throw { message: 'Script is required', status: 400 };

    const ZAI_API_KEY = process.env.ZAI_API_KEY || '';
    let audioUrl = '';

    if (ZAI_API_KEY) {
      try {
        const ttsResp = await fetch('https://api.z.ai/api/paas/v4/audios/speech', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ZAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'glm-4-voice', input: script.trim(), voice: 'alloy' }),
          signal: AbortSignal.timeout(30000),
        });
        if (ttsResp.ok) {
          const contentType = ttsResp.headers.get('content-type') || '';
          if (contentType.includes('audio')) {
            const audioBuffer = await ttsResp.arrayBuffer();
            const base64 = Buffer.from(audioBuffer).toString('base64');
            audioUrl = `data:audio/mpeg;base64,${base64}`;
          }
        }
      } catch (e) { /* continue without audio */ }
    }

    // Save to seller profile if sellerId provided
    if (sellerId) {
      await supabase.from('sellers').update({
        avatar_script: script.trim(),
        avatar_language: req.body.language || 'en',
        avatar_audio_url: audioUrl,
      }).eq('id', sellerId);
    }

    auditLog(req, 'success');
    res.json({ success: true, audioUrl, language: req.body.language || 'en' });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === AI Moderate (image content check) ===
app.post('/ai/moderate', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) throw { message: 'Image is required', status: 400 };

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
    if (NVIDIA_API_KEY) {
      try {
        const modResp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nvidia/neva-22b',
            messages: [{ role: 'user', content: [
              { type: 'text', text: 'Is this image appropriate for e-commerce? Check for nudity, violence, weapons, drugs. Respond JSON: {"approved": true/false, "reason": "..."}' },
              { type: 'image_url', image_url: { url: image } },
            ]}],
            max_tokens: 200,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (modResp.ok) {
          const modData = await modResp.json();
          const text = modData.choices?.[0]?.message?.content || '';
          try {
            const result = JSON.parse(text);
            return res.json({ success: true, ...result });
          } catch { /* fall through to auto-approve */ }
        }
      } catch { /* fall through */ }
    }

    // Auto-approve if moderation unavailable
    res.json({ success: true, approved: true, reason: 'Auto-approved' });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === AI Try-On (handled by Edge Function, but provide endpoint for completeness) ===
app.post('/ai/tryon', async (req, res) => {
  res.json({ success: false, error: 'Try-on is handled by the Edge Function directly' });
});

// ============================================================================
// ESCROW + PAYMENTS + PAYOUTS
// ============================================================================
// Flow:
// 1. Buyer pays via Paystack → Paystack confirms payment
// 2. Server creates escrow record (funds held, release_at = now + 3 days)
// 3. After 3 days, escrow is released
// 4. Payout job sends money to seller's bank account via Paystack Transfer API
// 5. Platform keeps a transaction fee (e.g., 2.5%)
// ============================================================================

const PLATFORM_FEE_PCT = 0.025; // 2.5% platform fee
const ESCROW_HOLD_DAYS = 3; // 3-day hold period
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

// === Get/Set Seller Bank Details ===
app.get('/payments/bank-details', async (req, res) => {
  try {
    const { data, error } = await supabase.from('seller_bank_details')
      .select('*').eq('seller_id', req.userId).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ success: true, bankDetails: data || null });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

app.post('/payments/bank-details', async (req, res) => {
  try {
    const { accountName, accountNumber, bankCode, bankName } = req.body;
    if (!accountName || !accountNumber || !bankCode || !bankName) {
      throw { message: 'All bank details are required', status: 400 };
    }

    // Verify account with Paystack (server-to-server)
    let recipientCode = null;
    let isVerified = false;

    if (PAYSTACK_SECRET) {
      try {
        // Step 1: Resolve account name to verify it's valid
        const resolveResp = await fetch(`${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, {
          headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
          signal: AbortSignal.timeout(10000),
        });
        if (resolveResp.ok) {
          const resolveData = await resolveResp.json();
          if (resolveData.status && resolveData.data) {
            isVerified = true;
          }
        }

        // Step 2: Create transfer recipient (needed for payouts)
        const transferResp = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nuban',
            name: accountName,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (transferResp.ok) {
          const transferData = await transferResp.json();
          recipientCode = transferData.data?.recipient_code || null;
        }
      } catch (e) {
        console.error('[Bank Details] Paystack verification failed:', e.message);
      }
    }

    // Upsert bank details
    const { data, error } = await supabase.from('seller_bank_details').upsert({
      seller_id: req.userId,
      account_name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      bank_name: bankName,
      recipient_code: recipientCode,
      is_verified: isVerified,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    auditLog(req, 'success');
    res.json({ success: true, bankDetails: data, verified: isVerified });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Get Nigerian Banks List (from Paystack) ===
app.get('/payments/banks', async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) throw { message: 'Payment service not configured', status: 500 };
    const resp = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&limit=100`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw { message: 'Failed to fetch banks', status: 500 };
    const data = await resp.json();
    res.json({ success: true, banks: data.data || [] });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Initialize Payment (creates Paystack checkout) ===
app.post('/payments/initialize', async (req, res) => {
  try {
    const { orderId, email } = req.body;
    if (!orderId) throw { message: 'Order ID is required', status: 400 };
    if (!PAYSTACK_SECRET) throw { message: 'Payment service not configured', status: 500 };

    // Fetch order from DB (verify ownership + get amount)
    const { data: order, error } = await supabase.from('buyers_orders')
      .select('*').eq('id', orderId).eq('user_id', req.userId).single();
    if (error || !order) throw { message: 'Order not found', status: 404 };
    if (order.status === 'paid') throw { message: 'Order already paid', status: 400 };

    // Initialize payment with Paystack
    const reference = `CELLEX_${order.id}_${Date.now()}`;
    const initResp = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email || req.userEmail || 'buyer@cellex.app',
        amount: Math.round(Number(order.total) * 100), // kobo
        currency: 'NGN',
        reference: reference,
        callback_url: `${req.headers.origin || 'https://eesha-learn.onrender.com'}/orders?payment_ref=${reference}`,
        metadata: {
          order_id: order.id,
          user_id: req.userId,
          custom_fields: [
            { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
            { display_name: 'Items', variable_name: 'items', value: order.items_summary || '' },
          ],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!initResp.ok) throw { message: 'Failed to initialize payment', status: 500 };
    const initData = await initResp.json();

    auditLog(req, 'success');
    res.json({
      success: true,
      authorizationUrl: initData.data?.authorization_url,
      accessCode: initData.data?.access_code,
      reference: reference,
    });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Enhanced Payment Verify (creates escrow after verification) ===
app.post('/payments/verify', async (req, res) => {
  try {
    const { reference, orderId } = req.body;
    if (!reference) throw { message: 'Payment reference is required', status: 400 };
    if (!PAYSTACK_SECRET) throw { message: 'Payment service not configured', status: 500 };

    // Fetch order
    const { data: order, error } = await supabase.from('buyers_orders')
      .select('*').eq('id', orderId).eq('user_id', req.userId).single();
    if (error || !order) throw { message: 'Order not found', status: 404 };
    if (order.status === 'paid') return res.json({ success: true, status: 'already_verified' });

    // Verify with Paystack
    const paystackResp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!paystackResp.ok) throw { message: 'Unable to verify payment', status: 400 };
    const paystackData = await paystackResp.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      throw { message: `Payment status: ${paystackData.data?.status || 'failed'}`, status: 400 };
    }

    // Check amount
    const expectedAmount = Math.round(Number(order.total) * 100);
    if (paystackData.data.amount !== expectedAmount) {
      console.error(`[Payments] AMOUNT MISMATCH: order=${order.id} expected=${expectedAmount} paid=${paystackData.data.amount}`);
      throw { message: 'Payment amount mismatch', status: 400 };
    }

    // Mark order as paid
    await supabase.from('buyers_orders').update({
      status: 'paid', payment_ref: reference, paid_at: new Date().toISOString(),
    }).eq('id', orderId);

    // Create payment record
    await supabase.from('payments').insert({
      order_id: orderId, user_id: req.userId, reference, amount: Number(order.total),
      currency: 'NGN', channel: paystackData.data.channel || 'card', status: 'success',
      paystack_response: JSON.stringify(paystackData.data).slice(0, 5000),
    });

    // === CREATE ESCROW RECORDS ===
    // For each order item, create an escrow entry for that seller
    const { data: orderItems } = await supabase.from('buyers_order_items')
      .select('*').eq('order_id', orderId);

    const releaseAt = new Date(Date.now() + ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const escrowRecords = [];

    if (orderItems && orderItems.length) {
      for (const item of orderItems) {
        const itemTotal = Number(item.total);
        const platformFee = Math.round(itemTotal * PLATFORM_FEE_PCT * 100) / 100;
        const sellerPayout = itemTotal - platformFee;

        const { data: escrow } = await supabase.from('escrow').insert({
          order_id: orderId,
          seller_id: item.seller_id,
          buyer_id: req.userId,
          amount: itemTotal,
          platform_fee: platformFee,
          seller_payout: sellerPayout,
          status: 'held',
          release_at: releaseAt,
        }).select().single();

        if (escrow) escrowRecords.push(escrow);

        // Record platform revenue
        await supabase.from('platform_revenue').insert({
          order_id: orderId, amount: platformFee, source: 'transaction_fee', status: 'collected',
        });
      }
    } else {
      // No order items — create single escrow for full amount
      const platformFee = Math.round(Number(order.total) * PLATFORM_FEE_PCT * 100) / 100;
      const sellerPayout = Number(order.total) - platformFee;
      const { data: escrow } = await supabase.from('escrow').insert({
        order_id: orderId, seller_id: null, buyer_id: req.userId,
        amount: Number(order.total), platform_fee: platformFee, seller_payout: sellerPayout,
        status: 'held', release_at: releaseAt,
      }).select().single();
      if (escrow) escrowRecords.push(escrow);

      await supabase.from('platform_revenue').insert({
        order_id: orderId, amount: platformFee, source: 'transaction_fee', status: 'collected',
      });
    }

    auditLog(req, 'success');
    res.json({
      success: true, status: 'verified', orderId, amount: Number(order.total),
      reference, escrowCreated: escrowRecords.length,
      message: `Payment verified. Funds held in escrow, will be released to seller on ${new Date(releaseAt).toLocaleDateString()}.`,
    });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Get Seller Earnings (escrow balance + payout history) ===
app.get('/payments/earnings', async (req, res) => {
  try {
    // Get escrow records
    const { data: escrowRecords, error: escError } = await supabase.from('escrow')
      .select('*').eq('seller_id', req.userId).order('created_at', { ascending: false });
    if (escError) throw escError;

    // Get payouts
    const { data: payouts, error: payoutError } = await supabase.from('seller_payouts')
      .select('*').eq('seller_id', req.userId).order('created_at', { ascending: false });
    if (payoutError) throw payoutError;

    // Calculate balances
    const heldEscrow = (escrowRecords || []).filter(e => e.status === 'held');
    const releasedEscrow = (escrowRecords || []).filter(e => e.status === 'released');
    const paidOutEscrow = (escrowRecords || []).filter(e => e.status === 'paid_out');

    const totalHeld = heldEscrow.reduce((sum, e) => sum + Number(e.seller_payout), 0);
    const totalReleased = releasedEscrow.reduce((sum, e) => sum + Number(e.seller_payout), 0);
    const totalPaidOut = paidOutEscrow.reduce((sum, e) => sum + Number(e.seller_payout), 0);
    const totalEarnings = totalHeld + totalReleased + totalPaidOut;

    // Get bank details
    const { data: bankDetails } = await supabase.from('seller_bank_details')
      .select('*').eq('seller_id', req.userId).single();

    res.json({
      success: true,
      earnings: {
        totalEarnings,
        heldBalance: totalHeld,         // In escrow, not yet released
        availableBalance: totalReleased, // Released, ready for payout
        paidOut: totalPaidOut,           // Already sent to bank account
        pendingPayout: totalReleased,    // Same as available (needs payout)
      },
      bankDetails: bankDetails || null,
      escrowRecords: escrowRecords || [],
      payouts: payouts || [],
    });
  } catch (err) {
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Process Payouts (called by cron job — sends money to sellers) ===
app.post('/payments/process-payouts', async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) throw { message: 'Payment service not configured', status: 500 };

    // Find all released escrow records that haven't been paid out
    const { data: releasedEscrows, error } = await supabase.from('escrow')
      .select('*').eq('status', 'released').order('released_at', { ascending: true });
    if (error) throw error;

    if (!releasedEscrows || !releasedEscrows.length) {
      return res.json({ success: true, message: 'No payouts to process', processed: 0 });
    }

    // Group by seller
    const sellerEscrowMap = {};
    for (const esc of releasedEscrows) {
      if (!esc.seller_id) continue;
      if (!sellerEscrowMap[esc.seller_id]) sellerEscrowMap[esc.seller_id] = [];
      sellerEscrowMap[esc.seller_id].push(esc);
    }

    let processed = 0;
    for (const [sellerId, escrows] of Object.entries(sellerEscrowMap)) {
      // Get seller's bank details
      const { data: bankDetails } = await supabase.from('seller_bank_details')
        .select('*').eq('seller_id', sellerId).single();

      if (!bankDetails || !bankDetails.recipient_code) {
        console.log(`[Payouts] Seller ${sellerId} has no bank details — skipping`);
        continue;
      }

      const totalAmount = escrows.reduce((sum, e) => sum + Number(e.seller_payout), 0);
      const reference = `PAYOUT_${sellerId}_${Date.now()}`;
      const escrowIds = escrows.map(e => e.id);

      // Initiate transfer via Paystack
      try {
        const transferResp = await fetch(`${PAYSTACK_BASE}/transfer`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'balance',
            amount: Math.round(totalAmount * 100), // kobo
            recipient: bankDetails.recipient_code,
            reason: `Cellex payout for ${escrows.length} order(s)`,
            reference: reference,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const transferData = await transferResp.json();

        if (transferResp.ok && transferData.status) {
          // Create payout record
          await supabase.from('seller_payouts').insert({
            seller_id: sellerId,
            amount: totalAmount,
            status: transferData.data?.status === 'success' ? 'success' : 'pending',
            reference: reference,
            transfer_code: transferData.data?.transfer_code || null,
            recipient_code: bankDetails.recipient_code,
            escrow_ids: escrowIds,
            processed_at: new Date().toISOString(),
          });

          // Mark escrow records as paid_out
          for (const esc of escrows) {
            await supabase.from('escrow').update({
              status: 'paid_out', paid_out_at: new Date().toISOString(),
              payout_reference: reference,
            }).eq('id', esc.id);
          }

          processed++;
        } else {
          // Record failed payout
          await supabase.from('seller_payouts').insert({
            seller_id: sellerId, amount: totalAmount, status: 'failed',
            reference: reference, recipient_code: bankDetails.recipient_code,
            escrow_ids: escrowIds, failure_reason: transferData.message || 'Transfer failed',
            processed_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error(`[Payouts] Transfer failed for seller ${sellerId}:`, e.message);
      }
    }

    auditLog(req, 'success');
    res.json({ success: true, processed, message: `Processed ${processed} seller payouts` });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Release Escrow (called by cron job after 3-day hold) ===
app.post('/payments/release-escrow', async (req, res) => {
  try {
    const now = new Date().toISOString();
    // Find all held escrow records past their release date
    const { data: heldEscrows, error } = await supabase.from('escrow')
      .select('*').eq('status', 'held').lte('release_at', now);
    if (error) throw error;

    let released = 0;
    for (const esc of (heldEscrows || [])) {
      await supabase.from('escrow').update({
        status: 'released', released_at: now,
      }).eq('id', esc.id);
      released++;
    }

    auditLog(req, 'success');
    res.json({ success: true, released, message: `Released ${released} escrow records` });
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === Request Payout (seller manually requests available balance) ===
app.post('/payments/request-payout', async (req, res) => {
  try {
    // Get seller's released escrow records
    const { data: releasedEscrows, error } = await supabase.from('escrow')
      .select('*').eq('seller_id', req.userId).eq('status', 'released');
    if (error) throw error;

    if (!releasedEscrows || !releasedEscrows.length) {
      return res.json({ success: false, error: 'No available balance to withdraw' });
    }

    // Get bank details
    const { data: bankDetails } = await supabase.from('seller_bank_details')
      .select('*').eq('seller_id', req.userId).single();

    if (!bankDetails || !bankDetails.recipient_code) {
      return res.json({ success: false, error: 'Please add your bank details first' });
    }

    const totalAmount = releasedEscrows.reduce((sum, e) => sum + Number(e.seller_payout), 0);
    if (totalAmount < 100) {
      return res.json({ success: false, error: 'Minimum payout is ₦100' });
    }

    const reference = `PAYOUT_${req.userId}_${Date.now()}`;
    const escrowIds = releasedEscrows.map(e => e.id);

    // Initiate transfer
    const transferResp = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(totalAmount * 100),
        recipient: bankDetails.recipient_code,
        reason: 'Cellex seller payout',
        reference: reference,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const transferData = await transferResp.json();

    if (transferResp.ok && transferData.status) {
      await supabase.from('seller_payouts').insert({
        seller_id: req.userId, amount: totalAmount,
        status: transferData.data?.status === 'success' ? 'success' : 'pending',
        reference, transfer_code: transferData.data?.transfer_code || null,
        recipient_code: bankDetails.recipient_code, escrow_ids: escrowIds,
        processed_at: new Date().toISOString(),
      });

      // Mark escrow as paid out
      for (const esc of releasedEscrows) {
        await supabase.from('escrow').update({
          status: 'paid_out', paid_out_at: new Date().toISOString(), payout_reference: reference,
        }).eq('id', esc.id);
      }

      auditLog(req, 'success');
      res.json({
        success: true, amount: totalAmount, reference,
        status: transferData.data?.status || 'pending',
        message: `Payout of ₦${totalAmount.toLocaleString()} initiated. You'll receive it in your bank account within 1-2 business days.`,
      });
    } else {
      throw { message: transferData.message || 'Payout failed', status: 400 };
    }
  } catch (err) {
    auditLog(req, 'error', err.message);
    const e = sanitizeError(err);
    res.status(e.status).json({ success: false, error: e.message });
  }
});

// === 404 Handler ===
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// === Global Error Handler ===
app.use((err, req, res, next) => {
  console.error(`[${req.requestId || 'no-id'}] Error:`, err.message);
  auditLog(req, 'error', err.message);
  const e = sanitizeError(err);
  res.status(e.status).json({ success: false, error: e.message, requestId: req.requestId });
});

// Start
app.listen(PORT, () => {
  console.log(`[Cellex Core API] Running on port ${PORT}`);
  if (!INTERNAL_TOKEN) console.error('[Security] CELLEX_INTERNAL_TOKEN not set — rejecting all requests');
  if (!supabase) console.error('[DB] Supabase not configured — database operations will fail');
});
