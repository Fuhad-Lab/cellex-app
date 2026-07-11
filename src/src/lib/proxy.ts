/**
 * Generic edge function proxy — used by all API routes.
 * Reads the session cookie, forwards to the Supabase edge function,
 * and returns the response.
 */
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

export async function proxyToEdgeFunction(edgeName: string, request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  const body = await request.text();

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }

  const botKey = request.headers.get('X-Bot-Api-Key');
  if (botKey) headers['X-Bot-Api-Key'] = botKey;
  const internalKey = request.headers.get('X-Internal-Call');
  if (internalKey) headers['X-Internal-Call'] = internalKey;

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/${edgeName}`, {
      method: 'POST',
      headers,
      body,
    });

    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: resp.status });
    } catch {
      return NextResponse.json({ success: false, error: `Non-JSON response: ${text.substring(0, 200)}` }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
