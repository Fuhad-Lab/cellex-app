import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Chat API route — calls NVIDIA NIM directly for fast responses (1-3s).
 * Uses Llama-3.1-8B-Instruct (sub-1s latency) for chat + overview generation.
 * Falls back to edge function for product search (which needs Supabase DB).
 * 
 * Vision relay: Llama-3.2-11B-Vision for image-to-text (when user uploads image).
 */

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_API_KEY = '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';
const BRAIN_MODEL = 'meta/llama-3.1-8b-instruct';
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct';

const SUPABASE_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0.p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg';
const COOKIE_NAME = 'cellex_session_id';

const SYSTEM_PROMPT = `You are Cellex AI, a friendly shopping assistant for Cellex — Nigeria's #1 social commerce marketplace.
Help users find products, compare prices, and make shopping decisions.
Prices are in Nigerian Naira (₦). Be concise, friendly, and helpful (2-3 sentences max).
If users ask about specific products, mention you can search for them.
For return policy: 7-day returns on most items in original condition.
For delivery: 48-hour shipping within Nigeria, free shipping on orders over ₦50,000.
For payment: PalmPay bank transfer with auto-verification, pay on delivery available.`;

// Keywords that trigger product search
const SEARCH_KEYWORDS = ['search', 'find', 'looking for', 'need', 'want', 'buy', 'show me', 'do you have', 'available', 'price', 'how much', 'under', 'over', 'cheap', 'best', 'recommend'];

function needsProductSearch(message: string): boolean {
  const lower = message.toLowerCase();
  return SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}

async function searchProducts(query: string): Promise<any[]> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/products`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ op: 'search', query }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || data.products || []).slice(0, 6);
  } catch {
    return [];
  }
}

async function describeImage(imageUrl: string): Promise<string> {
  try {
    const resp = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this product in detail (color, type, material, brand if visible) so I can search for it.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 150,
        stream: false,
      }),
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

async function callNVIDIA(messages: Array<{ role: string; content: string }>, maxTokens: number = 200): Promise<string> {
  const resp = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: BRAIN_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.5,
      stream: false,
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, history, image } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing "message"' }, { status: 400 });
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Handle image (vision relay)
    let userMessage = message;
    if (image) {
      const description = await describeImage(image);
      if (description) {
        userMessage = `User uploaded an image of: ${description}. User request: ${message}`;
      }
    }

    // Add context
    if (context) {
      messages.push({ role: 'system', content: `Context: ${context}` });
    }

    // Check if this needs product search
    const shouldSearch = needsProductSearch(message) || (context && context.includes('Search overview'));

    let products: any[] = [];
    if (shouldSearch) {
      // Search products in parallel with AI response
      const [aiReply, searchResults] = await Promise.all([
        callNVIDIA([...messages, { role: 'user', content: userMessage }], 200),
        searchProducts(message.replace(/under.*naira|over.*naira|cheap|best/gi, '').trim() || message),
      ]);
      products = searchResults;

      // If we found products, enhance the reply
      let finalReply = aiReply;
      if (products.length > 0) {
        const productList = products.slice(0, 4).map(p => `${p.name} (${formatPrice(p.price)})`).join(', ');
        finalReply = `${aiReply}\n\nI found ${products.length} products for you: ${productList}`;
      }

      return NextResponse.json({
        success: true,
        reply: finalReply,
        message: finalReply,
        content: finalReply,
        products: products.length > 0 ? products : null,
      });
    }

    // Simple chat (no product search) — fast path
    messages.push({ role: 'user', content: userMessage });
    const reply = await callNVIDIA(messages, 200);

    return NextResponse.json({
      success: true,
      reply,
      message: reply,
      content: reply,
      products: null,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      reply: "I'm having trouble right now. Please try again.",
    }, { status: 200 });
  }
}

function formatPrice(n: number): string {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
