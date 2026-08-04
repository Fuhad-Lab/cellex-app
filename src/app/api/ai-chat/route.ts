import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Chat API route
 *
 * Routes through the social Edge Function (op=ai_chat) — NO NVIDIA_API_KEY
 * or direct NVIDIA API calls in the frontend. The Edge Function handles
 * the NVIDIA call with its server-side API key.
 */

const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const COOKIE_NAME = 'cellex_session_id';

const SYSTEM_PROMPT = `You are Cellex AI, a friendly shopping assistant for Cellex — Nigeria's #1 social commerce marketplace.
Help users find products, compare prices, and make shopping decisions.
Prices are in Nigerian Naira (₦). Be concise, friendly, and helpful (2-3 sentences max).
If users ask about specific products, mention you can search for them.
If users ask about orders, shipping, or payments, direct them to the appropriate page.`;

export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        op: 'ai_chat',
        message: body.message || '',
        context: body.context || '',
        history: body.history || [],
        systemPrompt: SYSTEM_PROMPT,
      }),
      signal: AbortSignal.timeout(30000), // 30s — AI responses can take longer
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'AI service unavailable' }, { status: 500 });
  }
}
