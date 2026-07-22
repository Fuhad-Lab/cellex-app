import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Notifications API — real notifications from the buyers_notifications table.
 *
 * POST /api/notifications
 * Body: {
 *   op: 'list' | 'mark_read' | 'mark_all_read' | 'unread_count',
 *   notificationId?: string,  // for mark_read
 * }
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // === AUTH ===
  let userId = '';
  if (sessionId) {
    try {
      const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: 'session' }),
      });
      const authData = await authResp.json();
      if (authData.success && authData.user) {
        userId = authData.user.id;
      }
    } catch {}
  }

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }

  switch (body.op) {
    case 'list':           return await handleList(userId, body.limit || 50);
    case 'mark_read':      return await handleMarkRead(userId, body.notificationId);
    case 'mark_all_read':  return await handleMarkAllRead(userId);
    case 'unread_count':   return await handleUnreadCount(userId);
    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}

async function runSql(query: string) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'cellex-notifications',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[notifications] SQL error:', resp.status, errText.slice(0, 200));
    return null;
  }
  return await resp.json();
}

async function handleList(userId: string, limit: number) {
  const safeUserId = userId.replace(/'/g, "''");
  const query = `
    SELECT id, type, title, message, data, read, created_at
    FROM buyers_notifications
    WHERE user_id = '${safeUserId}'::uuid
    ORDER BY created_at DESC
    LIMIT ${Math.min(limit, 100)};
  `.trim();
  const rows = await runSql(query);
  if (rows === null) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  return NextResponse.json({
    success: true,
    notifications: (Array.isArray(rows) ? rows : []).map((n: any) => ({
      id: n.id,
      type: n.type || 'system',
      title: n.title || '',
      body: n.message || '',
      data: n.data || {},
      read: !!n.read,
      timestamp: n.created_at,
    })),
  });
}

async function handleMarkRead(userId: string, notificationId: string | undefined) {
  if (!notificationId) {
    return NextResponse.json({ success: false, error: 'notificationId required' }, { status: 400 });
  }
  const safeUserId = userId.replace(/'/g, "''");
  const safeId = String(notificationId).replace(/'/g, "''");
  const query = `
    UPDATE buyers_notifications SET read = true
    WHERE id = '${safeId}'::uuid AND user_id = '${safeUserId}'::uuid;
  `.trim();
  await runSql(query);
  return NextResponse.json({ success: true });
}

async function handleMarkAllRead(userId: string) {
  const safeUserId = userId.replace(/'/g, "''");
  const query = `
    UPDATE buyers_notifications SET read = true
    WHERE user_id = '${safeUserId}'::uuid AND read = false;
  `.trim();
  await runSql(query);
  return NextResponse.json({ success: true });
}

async function handleUnreadCount(userId: string) {
  const safeUserId = userId.replace(/'/g, "''");
  const query = `
    SELECT COUNT(*) AS count FROM buyers_notifications
    WHERE user_id = '${safeUserId}'::uuid AND read = false;
  `.trim();
  const rows = await runSql(query);
  const count = Array.isArray(rows) && rows[0] ? Number(rows[0].count) : 0;
  return NextResponse.json({ success: true, count });
}
