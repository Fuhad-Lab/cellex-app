import { NextRequest, NextResponse } from 'next/server';
import { sendGorseFeedback } from '@/lib/ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
const EDGE_FUNCTIONS_URL = 'https://tcwdbokruvlizkxcpkzj.supabase.co/functions/v1';
const PROJECT = 'tcwdbokruvlizkxcpkzj';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Comments API — real comments on feed posts (videos + products).
 *
 * POST /api/comments
 * Body: {
 *   op: 'list' | 'create' | 'delete',
 *   postType: 'video' | 'product',
 *   postId: number | string,
 *   commentText?: string,    // for create
 *   commentId?: number,      // for delete
 *   limit?: number,          // for list (default 50)
 * }
 *
 * Comments are stored denormalized (user_name + user_image snapshot at
 * comment time) so we don't need to join with the auth.users table.
 *
 * Creating a comment also fires a 'comment' feedback event to Gorse
 * (treated as a positive engagement signal for recommendations).
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
  let userName = '';
  let userImage = '';
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
        userName = authData.user.full_name || authData.user.email?.split('@')[0] || 'User';
        userImage = authData.user.profile_image || '';
      }
    } catch {}
  }

  switch (body.op) {
    case 'list':    return await handleList(body.postType, body.postId, body.limit || 50);
    case 'create':  return await handleCreate(userId, userName, userImage, body.postType, body.postId, body.commentText);
    case 'delete':  return await handleDelete(userId, body.commentId);
    default:
      return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
  }
}

/**
 * List comments for a post, ordered newest-first.
 */
async function handleList(postType: string, postId: string | number, limit: number) {
  if (!postType || !postId) {
    return NextResponse.json({ success: false, error: 'postType and postId required' }, { status: 400 });
  }
  if (!['video', 'product'].includes(postType)) {
    return NextResponse.json({ success: false, error: 'postType must be video or product' }, { status: 400 });
  }

  const safePostId = String(postId).replace(/'/g, "''");
  const query = `
    SELECT id, comment_text, created_at, user_id, user_name, user_image
    FROM feed_comments
    WHERE post_type = '${postType}' AND post_id = ${safePostId}::bigint
    ORDER BY created_at DESC
    LIMIT ${Math.min(limit, 200)};
  `.trim();

  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-comments',
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[comments] list error:', resp.status, errText.slice(0, 200));
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
    const data = await resp.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: true, comments: [] });
    }
    return NextResponse.json({
      success: true,
      comments: data.map((c: any) => ({
        id: c.id,
        text: c.comment_text,
        createdAt: c.created_at,
        userId: c.user_id,
        userName: c.user_name || 'User',
        userImage: c.user_image || '',
      })),
    });
  } catch (err) {
    console.error('[comments] list failed:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * Create a comment. Requires authentication.
 * Also fires a 'comment' feedback event to Gorse (positive engagement signal).
 */
async function handleCreate(
  userId: string,
  userName: string,
  userImage: string,
  postType: string,
  postId: string | number,
  commentText: string | undefined,
) {
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Login required to comment' }, { status: 401 });
  }
  if (!postType || !postId) {
    return NextResponse.json({ success: false, error: 'postType and postId required' }, { status: 400 });
  }
  if (!['video', 'product'].includes(postType)) {
    return NextResponse.json({ success: false, error: 'postType must be video or product' }, { status: 400 });
  }
  const text = (commentText || '').trim();
  if (!text) {
    return NextResponse.json({ success: false, error: 'Comment cannot be empty' }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ success: false, error: 'Comment too long (max 1000 chars)' }, { status: 400 });
  }

  const safeUserId = userId.replace(/'/g, "''");
  const safeUserName = userName.replace(/'/g, "''").slice(0, 100);
  const safeUserImage = userImage.replace(/'/g, "''").slice(0, 500);
  const safeText = text.replace(/'/g, "''");
  const safePostId = String(postId).replace(/'/g, "''");
  const query = `
    INSERT INTO feed_comments (post_type, post_id, user_id, comment_text, user_name, user_image)
    VALUES ('${postType}', ${safePostId}::bigint, '${safeUserId}'::uuid, '${safeText}', '${safeUserName}', '${safeUserImage}')
    RETURNING id, created_at;
  `.trim();

  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-comments',
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[comments] create error:', resp.status, errText.slice(0, 200));
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
    const data = await resp.json();
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Insert returned no row' }, { status: 500 });
    }

    // Fire 'comment' feedback to Gorse (non-blocking, fire-and-forget)
    // Gorse doesn't have a 'comment' type — map it to 'like' (positive engagement)
    try { sendGorseFeedback(userId, String(postId), 'like', 0.8); } catch {}

    return NextResponse.json({
      success: true,
      comment: {
        id: row.id,
        text,
        createdAt: row.created_at,
        userId,
        userName,
        userImage,
      },
    });
  } catch (err) {
    console.error('[comments] create failed:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * Delete a comment. Only the comment author can delete their own comments.
 */
async function handleDelete(userId: string, commentId: number) {
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }
  if (!commentId) {
    return NextResponse.json({ success: false, error: 'commentId required' }, { status: 400 });
  }

  const safeUserId = userId.replace(/'/g, "''");
  const safeCommentId = Number(commentId);
  if (!Number.isFinite(safeCommentId)) {
    return NextResponse.json({ success: false, error: 'Invalid commentId' }, { status: 400 });
  }

  const query = `
    DELETE FROM feed_comments
    WHERE id = ${safeCommentId} AND user_id = '${safeUserId}'::uuid
    RETURNING id;
  `.trim();

  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cellex-comments',
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[comments] delete error:', resp.status, errText.slice(0, 200));
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({ success: true, deleted: true });
    }
    return NextResponse.json({ success: false, error: 'Comment not found or not owned by you' }, { status: 404 });
  } catch (err) {
    console.error('[comments] delete failed:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
