import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Seller Profile API Route — proxies to the Supabase Edge Function.
 * Uses the anon key (not the expired management token).
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.text();

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json',
  };

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/seller-profile`, {
      method: 'POST',
      headers,
      body,
    });

    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: resp.status });
    } catch {
      return NextResponse.json({ success: false, error: `Non-JSON: ${text.substring(0, 200)}` }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
