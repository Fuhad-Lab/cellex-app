import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Messenger API — E2E encrypted messaging
 *
 * Messages are encrypted client-side with AES-GCM (Web Crypto API).
 * The server only stores encrypted_content + IV — it can NEVER read messages.
 *
 * Operations:
 *   - list:     Get all conversations for the authenticated user
 *   - messages: Get all messages in a conversation
 *   - send:     Send an encrypted message
 *   - create:   Create or get an existing conversation with another user
 */

export async function POST(request: NextRequest) {
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_ANON_KEY not set' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Step 1: Get the user ID via the auth edge function
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
    if (!authData.success || !authData.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userId = authData.user.id;

    // Step 2: Use SQL API for all messenger operations
    if (!SUPABASE_TOKEN) {
      return NextResponse.json({ success: false, error: 'SUPABASE_TOKEN not set' }, { status: 500 });
    }

    const sqlHeaders: Record<string, string> = {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const sqlApiUrl = `https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query`;

    switch (body.op) {
      case 'list': {
        // Get all conversations where the user is a participant
        const query = `
          SELECT c.*,
            u1.email as p1_email, u2.email as p2_email,
            s.business_name as p1_name, s2.business_name as p2_name
          FROM conversations c
          LEFT JOIN auth.users u1 ON c.participant1 = u1.id
          LEFT JOIN auth.users u2 ON c.participant2 = u2.id
          LEFT JOIN sellers s ON c.participant1 = s.id
          LEFT JOIN sellers s2 ON c.participant2 = s2.id
          WHERE c.participant1 = '${userId}'::uuid OR c.participant2 = '${userId}'::uuid
          ORDER BY c.last_message_at DESC;
        `;
        const resp = await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query }),
        });
        const data = await resp.json();
        if (Array.isArray(data)) {
          // Transform to include the "other participant" info
          const conversations = data.map((c: any) => {
            const isP1 = c.participant1 === userId;
            return {
              id: c.id,
              type: c.type,
              lastMessage: c.last_message || '',
              lastMessageAt: c.last_message_at,
              otherUserId: isP1 ? c.participant2 : c.participant1,
              otherUserEmail: isP1 ? c.p2_email : c.p1_email,
              otherUserName: isP1 ? c.p2_name || c.p2_email : c.p1_name || c.p1_email,
            };
          });
          return NextResponse.json({ success: true, conversations });
        }
        return NextResponse.json({ success: true, conversations: [] });
      }

      case 'messages': {
        const convId = body.conversationId;
        if (!convId) {
          return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 });
        }
        const query = `
          SELECT m.*, u.email as sender_email
          FROM messages m
          JOIN auth.users u ON m.sender_id = u.id
          WHERE m.conversation_id = '${convId}'::uuid
          ORDER BY m.created_at ASC
          LIMIT 100;
        `;
        const resp = await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query }),
        });
        const data = await resp.json();
        if (Array.isArray(data)) {
          return NextResponse.json({ success: true, messages: data });
        }
        return NextResponse.json({ success: true, messages: [] });
      }

      case 'send': {
        const { conversationId, encryptedContent, iv } = body;
        if (!conversationId || !encryptedContent || !iv) {
          return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }
        const query = `
          INSERT INTO messages (conversation_id, sender_id, encrypted_content, iv)
          VALUES ('${conversationId}'::uuid, '${userId}'::uuid, '${encryptedContent.replace(/'/g, "''")}', '${iv}')
          RETURNING *;
        `;
        const resp = await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query }),
        });
        const data = await resp.json();

        // Update conversation's last_message
        const updateQuery = `
          UPDATE conversations SET last_message = '[Encrypted message]', last_message_at = NOW()
          WHERE id = '${conversationId}'::uuid;
        `;
        await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query: updateQuery }),
        });

        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json({ success: true, message: data[0] });
        }
        return NextResponse.json({ success: false, error: 'Send failed' }, { status: 500 });
      }

      case 'create': {
        const { otherUserId, type, groupBuyId } = body;
        if (!otherUserId) {
          return NextResponse.json({ success: false, error: 'otherUserId required' }, { status: 400 });
        }
        // Try to find existing conversation
        const findQuery = `
          SELECT * FROM conversations
          WHERE (participant1 = '${userId}'::uuid AND participant2 = '${otherUserId}'::uuid)
             OR (participant1 = '${otherUserId}'::uuid AND participant2 = '${userId}'::uuid)
          LIMIT 1;
        `;
        const findResp = await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query: findQuery }),
        });
        const findData = await findResp.json();

        if (Array.isArray(findData) && findData.length > 0) {
          return NextResponse.json({ success: true, conversation: findData[0] });
        }

        // Create new conversation
        const convType = type || 'direct';
        const gbId = groupBuyId ? `'${groupBuyId}'::uuid` : 'NULL';
        const createQuery = `
          INSERT INTO conversations (type, participant1, participant2, group_buy_id)
          VALUES ('${convType}', '${userId}'::uuid, '${otherUserId}'::uuid, ${gbId})
          RETURNING *;
        `;
        const createResp = await fetch(sqlApiUrl, {
          method: 'POST', headers: sqlHeaders,
          body: JSON.stringify({ query: createQuery }),
        });
        const createData = await createResp.json();

        if (Array.isArray(createData) && createData.length > 0) {
          return NextResponse.json({ success: true, conversation: createData[0] });
        }
        return NextResponse.json({ success: false, error: 'Create failed' }, { status: 500 });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown op: ${body.op}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
