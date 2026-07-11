import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

export async function POST(request: NextRequest) {
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
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await resp.json();
    const bodyJson = JSON.parse(body);

    if (bodyJson.op === 'login' || bodyJson.op === 'signup') {
      if (data.success && data.session_id) {
        const response = NextResponse.json(
          { ...data, session_id: undefined },
          { status: resp.status }
        );
        response.cookies.set(COOKIE_NAME, data.session_id, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
        return response;
      }
    }

    if (bodyJson.op === 'logout') {
      const response = NextResponse.json(data, { status: resp.status });
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
