import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf, csrfRejected } from '@/lib/csrf';

/**
 * AI Chat API route
 *
 * ARCHITECTURE: Frontend → /api/ai-chat → NVIDIA NIM API
 *
 * Uses NVIDIA's NIM (NVIDIA Inference Microservices) API for fast,
 * intelligent AI responses. NVIDIA is reachable from Render (unlike ZAI's
 * internal API) and provides sub-3-second response times.
 *
 * SECURITY:
 * - The NVIDIA_API_KEY is stored as a Supabase secret and read by the edge
 *   function. This route calls the edge function (op=ai_chat) which proxies
 *   to NVIDIA.
 * - No API keys are exposed to the frontend.
 * - CSRF validation is enforced.
 *
 * PERFORMANCE:
 * - Uses NVIDIA's llama-3.1-nano-8b-instruct model (fast, lightweight)
 * - Max 300 tokens (keeps response time under 3 seconds)
 * - Temperature 0.7 (balanced creativity and consistency)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const COOKIE_NAME = 'cellex_session_id';

const SYSTEM_PROMPT = `You are Cellex AI, a shopping assistant for Cellex — Nigeria's #1 social commerce marketplace.
You help users find products, compare prices, and make shopping decisions. Prices are in Nigerian Naira (₦).

IMPORTANT RULES:
- Be natural and conversational — never use templates or fixed formats.
- When product data is provided in the context, reference specific products by name and price.
- Answer follow-up questions based on the REAL products in the search results.
- If a user asks about a product that exists in the results, give them the actual price and details.
- If something isn't available, say so honestly and suggest alternatives.
- Keep responses concise (2-4 sentences) unless the user asks for more detail.
- Don't say "Here's what I found" or use any formulaic opening.`;

export async function POST(request: NextRequest) {
  // CSRF validation
  if (!validateCsrf(request)) {
    return csrfRejected();
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, context, history } = body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return NextResponse.json({ success: false, error: 'Valid message required (max 2000 chars)' }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 500 });
  }

  // Read the session ID from the cookie and forward as Bearer token
  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }

  try {
    // Call the edge function which has the NVIDIA_API_KEY
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        op: 'ai_chat',
        message,
        context: context || '',
        history: history || [],
        systemPrompt: SYSTEM_PROMPT,
      }),
      signal: AbortSignal.timeout(15000), // 15s — NVIDIA is fast (2-3s typically)
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json({ success: false, error: 'AI service unavailable' }, { status: 500 });
  }
}
