/// <reference lib="deno.ns" />
// Cellex AI Chat Edge Function
// ---------------------------------
// Replaces the HF Space backend (eeshamart-ai-space/app.py).
// All AI logic, prompt building, function calling, and Supabase product
// search happen here — the frontend never sees the AI model URL, the
// Supabase keys, or the system prompt.
//
// Security benefits:
//   - HF Router URL + token stay server-side
//   - Supabase service role key stays server-side
//   - AI system prompt stays server-side (not visible in page source)
//   - Frontend only sends { message, image?, context } and gets { response, products, action }

import { corsHeaders, jsonResponse, errorResponse, getUser, supabaseSelect, supabaseInsert, supabaseUpdate, supabaseDelete } from '../_shared/cors.ts';

// ---- Configuration (all server-side, never exposed to frontend) ----
const HF_ROUTER_URL = Deno.env.get('HF_ROUTER_URL') || 'https://router.huggingface.co/v1/chat/completions';
const HF_INFERENCE_MODEL = Deno.env.get('HF_INFERENCE_MODEL') || 'Qwen/Qwen2.5-72B-Instruct';
const HF_TOKEN = Deno.env.get('HF_TOKEN') || '';
const MAX_NEW_TOKENS = parseInt(Deno.env.get('MAX_NEW_TOKENS') || '512');
const AI_TIMEOUT = parseInt(Deno.env.get('AI_TIMEOUT') || '60');

// Functions that require login (anything except search_products)
const ALLOWED_WHEN_LOGGED_OUT = new Set(['search_products']);

// ---- Main handler ----

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await req.json();
    const { message, context } = body;

    if (!message) {
      return errorResponse('Missing "message" field', 400);
    }

    // Check if user is logged in
    const user = await getUser(req);
    const isLoggedIn = !!user;

    const ctx = context || {};
    const cartItems = ctx.cartItems || [];
    const shownProducts = ctx.lastShownProducts || [];
    const conversationHistory = ctx.conversationHistory || [];
    const userImage = ctx.image;

    // If user is logged in, fetch their REAL cart from the database (server-side)
    let realCartItems = cartItems;
    if (isLoggedIn) {
      const dbCart = await supabaseSelect(
        'cart_items',
        'id, quantity, product_id, products(id, name, price, image_url, category)',
        { user_id: `eq.${user.id}` }
      );
      if (dbCart.length > 0) {
        realCartItems = dbCart.map((item: Record<string, unknown>) => ({
          product_name: (item.products as Record<string, unknown>)?.name || 'Item',
          price: (item.products as Record<string, unknown>)?.price || 0,
          quantity: item.quantity || 1,
        }));
      }
    }

    // Analyze image if provided (BLIP vision model)
    let imageDescription: string | null = null;
    if (userImage) {
      imageDescription = await analyzeImage(userImage);
      console.log('Image contains:', imageDescription);
    }

    // Get all available products for AI context
    const allProducts = await supabaseSelect(
      'products',
      'id, name, price, category',
      {},
      { order: 'created_at', ascending: false, limit: 100 }
    );

    // Call the AI model
    const aiResult = await callAI(
      message,
      realCartItems,
      shownProducts,
      conversationHistory,
      allProducts as Record<string, unknown>[],
      imageDescription,
      isLoggedIn
    );

    console.log('AI result:', JSON.stringify(aiResult).substring(0, 200));

    const reply = (aiResult.reply || '').trim();
    const calls = aiResult.calls || [];

    // Build the response
    const result: Record<string, unknown> = {
      success: true,
      response: reply,
      products: null,
      action: null,
      image_description: imageDescription,
    };

    // Execute function calls
    if (calls && calls.length > 0) {
      for (const call of calls) {
        const funcName: string = (call.function as string) || '';
        const args: Record<string, unknown> = (call.args as Record<string, unknown>) || {};

        // Auth check: block non-search functions if not logged in
        if (!isLoggedIn && !ALLOWED_WHEN_LOGGED_OUT.has(funcName)) {
          result.action = { type: 'login_required' };
          // Clear reply if it leaks cart state
          const replyLower = reply.toLowerCase();
          if (!['login', 'log in', 'sign in', 'account'].some(k => replyLower.includes(k))) {
            result.response = '';
          }
          continue;
        }

        if (funcName === 'search_products') {
          const query = (args.query as string) || message;
          const maxPrice = args.max_price as number | undefined;

          let filterQuery = query;
          if (imageDescription && imageDescription !== 'an image') {
            const words = imageDescription.toLowerCase().split(' ').slice(0, 4);
            for (const word of words) {
              if (word.length > 2 && !query.toLowerCase().includes(word)) {
                filterQuery += ` ${word}`;
              }
            }
          }

          const products = await searchProducts(filterQuery, maxPrice);
          result.products = products;
        }

        else if (funcName === 'add_to_cart') {
          const productNumber = (args.product_number as number) || 1;
          result.action = { type: 'add_to_cart', product_index: productNumber, quantity: 1 };
        }

        else if (funcName === 'remove_from_cart') {
          const productNumber = (args.product_number as number) || 1;
          result.action = {
            type: 'remove_from_cart',
            product_index: productNumber,
            product_number: productNumber,
            cart_item_number: productNumber,
          };
        }

        else if (funcName === 'clear_cart') {
          result.action = { type: 'clear_cart' };
        }

        else if (funcName === 'view_cart') {
          result.action = { type: 'view_cart' };
        }

        else if (funcName === 'checkout') {
          result.action = { type: 'checkout' };
        }

        else if (funcName === 'update_cart') {
          const cartItemNumber = (args.cart_item_number as number) || 1;
          const newQuantity = (args.new_quantity as number) || 1;
          result.action = {
            type: 'update_cart',
            cart_item_number: cartItemNumber,
            new_quantity: newQuantity,
          };
        }

        else {
          console.log('Unknown function:', funcName);
        }
      }
    }

    // Second-line defense: if user is not logged in and message looks like cart op
    if (!isLoggedIn && !result.action) {
      if (messageRequestsCartOperation(message)) {
        result.action = { type: 'login_required' };
        const replyLower = reply.toLowerCase();
        if (!['login', 'log in', 'sign in', 'account'].some(k => replyLower.includes(k))) {
          result.response = '';
        }
      }
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('Edge function error:', error);
    return errorResponse(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
});

// ---- AI Model Call ----

async function callAI(
  message: string,
  cartItems: Record<string, unknown>[],
  shownProducts: Record<string, unknown>[],
  conversationHistory: Record<string, unknown>[],
  allProducts: Record<string, unknown>[],
  imageDescription: string | null,
  isLoggedIn: boolean
): Promise<{ reply: string; calls: Record<string, unknown>[] }> {
  // Build context block
  const contextParts: string[] = [];

  if (cartItems && cartItems.length > 0) {
    const totalQty = cartItems.reduce((sum: number, item: Record<string, unknown>) => sum + ((item.quantity as number) || 1), 0);
    const totalCost = cartItems.reduce((sum: number, item: Record<string, unknown>) => {
      const price = (item.price as number) || 0;
      const qty = (item.quantity as number) || 1;
      return sum + price * qty;
    }, 0);

    const lines = cartItems.map((item: Record<string, unknown>, i: number) => {
      const name = (item.product_name as string) || 'Item';
      const price = (item.price as number) || 0;
      const qty = (item.quantity as number) || 1;
      return `  ${i + 1}. ${name} x${qty} = N${(price * qty).toLocaleString()}`;
    });

    contextParts.push(
      `[CURRENT CART: ${totalQty} total products (${cartItems.length} types), value N${totalCost.toLocaleString()}]\n${lines.join('\n')}`
    );
  } else {
    contextParts.push('[CURRENT CART: empty]');
  }

  if (shownProducts && shownProducts.length > 0) {
    const lines = shownProducts.map((p: Record<string, unknown>, i: number) => {
      const name = (p.name as string) || 'Product';
      const price = (p.price as number) || 0;
      return `  ${i + 1}. ${name} - N${price.toLocaleString()}`;
    });
    contextParts.push(`[RECENTLY SHOWN PRODUCTS (user can refer to by number)]\n${lines.join('\n')}`);
  }

  if (imageDescription) {
    contextParts.push(`[USER SENT IMAGE showing: ${imageDescription}]`);
  }

  const contextBlock = contextParts.join('\n\n');

  // Available products block
  let availableBlock = '';
  if (allProducts && allProducts.length > 0) {
    const lines = allProducts.slice(0, 25).map((p: Record<string, unknown>) => {
      const name = (p.name as string) || '';
      const price = (p.price as number) || 0;
      const category = (p.category as string) || 'General';
      return `- ${name} (N${price.toLocaleString()}, ${category})`;
    });
    availableBlock = `\n\n[STORE PRODUCTS:]\n${lines.join('\n')}`;
  }

  // System prompt (stays server-side — never exposed to frontend)
  const system = `You are Cellex, a smart AI assistant for Cellex (Nigerian online store, prices in Naira N).
You are helpful, friendly, and knowledgeable. You can discuss ANY topic naturally.
You have real conversation memory - you remember what was said before.

You have ACCESS TO FUNCTIONS. When you decide a function should be called, include it in your JSON response.
When NO function is needed (just chatting, answering questions, etc.), respond with only a reply.

AVAILABLE FUNCTIONS:
1. search_products(query: str, max_price?: number) - Search store for products matching the query
2. add_to_cart(product_number: int) - Add a product to cart (use number from RECENTLY SHOWN PRODUCTS)
3. remove_from_cart(product_number: int) - Remove a product from cart (use number from CURRENT CART)
4. clear_cart() - Empty the entire cart, remove everything
5. view_cart() - Show cart contents
6. checkout() - Start the checkout process
7. update_cart(cart_item_number: int, new_quantity: int) - Change quantity of a cart item (use number from CURRENT CART). Set new_quantity to 0 to remove it.

RESPONSE FORMAT - You MUST respond as valid JSON ONLY (no markdown, no code fences, no prose before or after).
The "reply" field is ALWAYS REQUIRED - it is the message shown to the user. Never omit it.
Write a natural, contextual reply that acknowledges what you are doing or what you found.

For normal chat (no action needed):
{"reply": "your response here"}

When you want to call a function:
{"reply": "what you say to the user", "calls": [{"function": "function_name", "args": {"param": "value"}}]}

You can call MULTIPLE functions at once if needed.
You can also respond with NO calls - just a reply - when the user is chatting, asking questions, or no action is needed.

IMPORTANT:
- When user sends a product image, IMMEDIATELY call search_products with what you see in the image
- When user describes something abstractly (e.g. "something that flies and records video"), infer the product type and call search_products with a relevant query (e.g. "drone")
- Always count TOTAL products (sum quantities), not types. If cart has item1 x2 and item2 x3, total is 5
- When user says "clear cart", "empty cart", "remove everything", "I don't want any products" - call clear_cart
- When user says "remove X" or "take out X" - call remove_from_cart with the cart item number
- When user says "change quantity to X", "I want X of this", "update to X" - call update_cart
- When user says "that one", "the first one", "number 3" - refer to the products lists above
- Respect negatives: "don't" means do NOT do it, "no" means no
- Be natural and conversational. Do not be robotic or templated.

CRITICAL - ALWAYS CALL THE FUNCTION WHEN THE USER ASKS FOR A CART OPERATION:
- When the user asks to view/show/see their cart (e.g. "show my cart", "what's in my cart", "view cart"), you MUST call view_cart() - NEVER answer from the [CURRENT CART] context block yourself. The backend will handle login enforcement and cart retrieval.
- When the user asks to add/remove/clear/update cart, you MUST call the corresponding function - NEVER say "your cart is empty" or "already done" based on the context block alone.
- The context block is for your reference to write a good reply, NOT a substitute for calling the function. The function call is what actually performs the action on the user's real cart.
- Even if you can see the cart is empty from the context, still call view_cart() when the user asks to see their cart - the backend needs the function call to enforce authentication.${contextBlock}${availableBlock}`;

  // Build messages
  const messages: Record<string, unknown>[] = [{ role: 'system', content: system }];

  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-10);
    for (const msg of recent) {
      const role = (msg.role as string) || 'user';
      let content = (msg.content as string) || '';
      if (content && (role === 'user' || role === 'assistant')) {
        // Clean JSON artifacts from assistant history
        if (role === 'assistant' && content.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.reply || content;
          } catch {
            // keep original
          }
        }
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  // Call HF Router
  try {
    const payload = {
      model: HF_INFERENCE_MODEL,
      messages,
      max_tokens: MAX_NEW_TOKENS,
      temperature: 0.7,
      top_p: 0.9,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT * 1000);

    const resp = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`HF Router HTTP ${resp.status}: ${await resp.text()}`);
      return { reply: "I'm having trouble connecting to my brain right now. Please try again in a moment.", calls: [] };
    }

    const data = await resp.json();
    const responseText = (data?.choices?.[0]?.message?.content || '').trim();
    console.log('AI raw response:', responseText.substring(0, 200));

    // Parse the JSON response
    const parsed = parseAIResponse(responseText);
    if (parsed) {
      return parsed;
    }

    // Fallback: return raw text as reply
    return { reply: responseText, calls: [] };
  } catch (error) {
    console.error('AI call error:', error);
    return { reply: "I'm having trouble right now. Please try again.", calls: [] };
  }
}

// ---- JSON Parser (handles small-model malformations) ----

function parseAIResponse(response: string): { reply: string; calls: Record<string, unknown>[] } | null {
  if (!response) return null;

  // Strip code fences if present
  let stripped = response.trim();
  if (stripped.startsWith('```')) {
    const lines = stripped.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim() === '```') lines.pop();
    stripped = lines.join('\n').trim();
    response = stripped;
  }

  const jsonStart = response.indexOf('{');
  if (jsonStart === -1) return null;

  // Strategy 1: bracket-matched extraction
  const balancedEnd = findBalancedJsonEnd(response, jsonStart);
  if (balancedEnd > jsonStart) {
    const jsonStr = response.substring(jsonStart, balancedEnd);
    const result = tryParse(jsonStr);
    if (result) return result;
  }

  // Strategy 2: first-{ to last-}
  const jsonEnd = response.lastIndexOf('}') + 1;
  if (jsonEnd > jsonStart) {
    const jsonStr = response.substring(jsonStart, jsonEnd);
    const result = tryParse(jsonStr);
    if (result) return result;
  }

  return null;
}

function tryParse(jsonStr: string): { reply: string; calls: Record<string, unknown>[] } | null {
  try {
    const result = JSON.parse(jsonStr);
    if (typeof result !== 'object' || result === null) return null;
    if (!result.reply) result.reply = '';
    if (!result.calls) result.calls = [];
    return result;
  } catch {
    return null;
  }
}

function findBalancedJsonEnd(s: string, start: number): number {
  if (start >= s.length || s[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// ---- Product Search ----

async function searchProducts(query: string, maxPrice?: number): Promise<Record<string, unknown>[]> {
  const terms = query.toLowerCase().replace(/-/g, ' ').split(' ').filter(t => t.length > 1);

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'show', 'me', 'find',
    'search', 'looking', 'want', 'please', 'you', 'get', 'i', 'this',
    'that', 'it', 'and', 'or', 'but', 'not', 'no', 'yes', 'what', 'how',
    'why', 'when', 'where', 'which', 'who', 'some', 'any', 'all', 'each',
    'more', 'also', 'very', 'much', 'many', 'too', 'just', 'only'
  ]);

  const searchTerms = terms.filter(t => !stopWords.has(t));
  if (searchTerms.length === 0) {
    searchTerms.push(...terms.slice(-3));
  }

  // Build OR filter for Supabase REST
  const filters = searchTerms.map(t => `name.ilike.%${t}%`).concat(
    searchTerms.map(t => `category.ilike.%${t}%`),
    searchTerms.map(t => `description.ilike.%${t}%`)
  );

  const { url, headers } = {
    url: Deno.env.get('SUPABASE_URL')!,
    headers: {
      'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
      'Content-Type': 'application/json',
    },
  };

  let query_url = `${url}/rest/v1/products?select=*&or=(${encodeURIComponent(filters.join(','))})&order=created_at.desc&limit=20`;

  if (maxPrice) {
    query_url += `&price=lte.${maxPrice}`;
  }

  console.log('Search URL:', query_url.substring(0, 150));

  try {
    const resp = await fetch(query_url, { headers });
    if (!resp.ok) {
      console.error('Search error:', resp.status);
      return [];
    }
    return await resp.json();
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// ---- Image Analysis (BLIP via HF Router) ----
// Note: BLIP is not available on HF Router. We use a simple description
// placeholder for now. If you need real image analysis, you can:
// 1. Host BLIP on the HF Space and call it here
// 2. Use a vision model available on HF Router (when supported)
// 3. Use a different vision API

async function analyzeImage(base64Image: string): Promise<string> {
  // For now, return a generic description
  // TODO: integrate with a vision model
  console.log('Image analysis requested but not implemented in edge function yet');
  return 'an image';
}

// ---- Cart Intent Detection (for login enforcement) ----

function messageRequestsCartOperation(message: string): boolean {
  const msg = message.toLowerCase().trim();

  const cartViewPatterns = [
    /\b(view|show|see|check|what'?s in|look at)\b.*\bcart\b/,
    /\bcart\b.*\b(view|show|see|check|contents?|items?)\b/,
    /\bmy cart\b/,
  ];

  const cartModifyPatterns = [
    /\b(add|put|include)\b.*\bcart\b/,
    /\badd to cart\b/,
    /\b(remove|delete|take out|take off)\b.*\bcart\b/,
    /\b(clear|empty|wipe)\b.*\bcart\b/,
    /\bcheckout\b/,
    /\b(update|change)\b.*\b(quantity|cart|item)\b/,
    /\b(update|change)\b.*\bto\b.*\d/,
    /\bbuy (now|this|the|it)\b/,
    /\border (this|the|it|now)\b/,
  ];

  for (const pattern of [...cartViewPatterns, ...cartModifyPatterns]) {
    if (pattern.test(msg)) return true;
  }

  return false;
}
