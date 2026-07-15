import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || ''; // Management API token (sbp_...)
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const COOKIE_NAME = 'cellex_session_id';

/**
 * Seller Profile API Route
 *
 * Handles seller profile creation and retrieval. Uses two mechanisms:
 *   1. The auth edge function (via the generic proxy) to authenticate the user
 *      and get their UUID from the web_sessions table
 *   2. The Supabase SQL API (management token) to UPSERT into the sellers table
 *
 * The seller-profile edge function has a bug where UPSERT returns success but
 * doesn't actually create the seller. This route bypasses that by doing the
 * SQL UPSERT directly via the management API.
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

  // Step 1: Get the user by calling the auth edge function's "session" op
  // This works because the edge function uses Deno.env which has valid keys
  const authHeaders: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json',
  };

  try {
    const authResp = await fetch(`${EDGE_FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ op: 'session' }),
    });

    const authData = await authResp.json();
    if (!authData.success || !authData.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;

    // Step 2: Handle the operation using the SQL API (management token)
    if (!SUPABASE_TOKEN) {
      return NextResponse.json({ success: false, error: 'SUPABASE_TOKEN not set' }, { status: 500 });
    }

    const sqlHeaders: Record<string, string> = {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    };

    if (body.op === 'get') {
      // Look up the seller by user UUID
      const sqlResp = await fetch(
        `https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query`,
        {
          method: 'POST',
          headers: sqlHeaders,
          body: JSON.stringify({
            query: `SELECT * FROM sellers WHERE id = '${userId}'::uuid LIMIT 1;`,
          }),
        }
      );

      const sqlData = await sqlResp.json();
      if (Array.isArray(sqlData) && sqlData.length > 0) {
        return NextResponse.json({ success: true, seller: sqlData[0] });
      }
      return NextResponse.json({ success: true, seller: null });
    }

    if (body.op === 'update') {
      // UPSERT: Insert with the user's UUID, or update if exists
      const businessName = (body.business_name || '').replace(/'/g, "''");
      const businessDesc = (body.business_description || '').replace(/'/g, "''");
      const businessCat = (body.business_category || 'General').replace(/'/g, "''");
      const businessLoc = (body.business_location || '').replace(/'/g, "''");
      const sellerType = (body.seller_type || 'business').replace(/'/g, "''");
      const farmName = (body.farm_name || '').replace(/'/g, "''");
      const profileImage = (body.profile_image || '').replace(/'/g, "''");
      const emailEscaped = (userEmail || '').replace(/'/g, "''");

      const sqlQuery = `
        INSERT INTO sellers (id, email, business_name, business_description, business_category, business_location, seller_type, farm_name, profile_image, status, email_verified, created_at, updated_at)
        VALUES ('${userId}'::uuid, '${emailEscaped}', '${businessName}', '${businessDesc}', '${businessCat}', '${businessLoc}', '${sellerType}', '${farmName}', '${profileImage}', 'active', true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          business_name = EXCLUDED.business_name,
          business_description = EXCLUDED.business_description,
          business_category = EXCLUDED.business_category,
          business_location = EXCLUDED.business_location,
          seller_type = EXCLUDED.seller_type,
          farm_name = EXCLUDED.farm_name,
          profile_image = EXCLUDED.profile_image,
          updated_at = NOW()
        RETURNING *;
      `;

      const sqlResp = await fetch(
        `https://api.supabase.com/v1/projects/tcwdbokruvlizkxcpkzj/database/query`,
        {
          method: 'POST',
          headers: sqlHeaders,
          body: JSON.stringify({ query: sqlQuery }),
        }
      );

      const sqlData = await sqlResp.json();
      if (Array.isArray(sqlData) && sqlData.length > 0) {
        return NextResponse.json({ success: true, seller: sqlData[0] });
      }

      // Check for error
      if (sqlData.message) {
        return NextResponse.json(
          { success: false, error: sqlData.message.substring(0, 200) },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: `Unknown operation: ${body.op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
