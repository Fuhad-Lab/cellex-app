import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcwdbokruvlizkxcpkzj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Seller Profile API Route
 *
 * This route handles seller profile creation and retrieval DIRECTLY via the
 * Supabase REST API (not through the edge function, which has a bug where
 * UPSERT returns success but doesn't actually create the seller).
 *
 * Operations:
 *   - get:    Look up the seller by the authenticated user's UUID
 *   - update: UPSERT the seller profile (create if doesn't exist, update if it does)
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

  // Step 1: Get the user ID from the web_sessions table
  // The session_id cookie maps to a web_sessions row which has the auth user UUID
  const serviceHeaders: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const sessionResp = await fetch(
      `${SUPABASE_URL}/rest/v1/web_sessions?select=user_id,access_token&session_id=eq.${sessionId}&limit=1`,
      { headers: serviceHeaders }
    );

    if (!sessionResp.ok) {
      return NextResponse.json({ success: false, error: 'Session lookup failed' }, { status: 401 });
    }

    const sessionData = await sessionResp.json();
    if (!sessionData || sessionData.length === 0) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userId = sessionData[0].user_id;
    const accessToken = sessionData[0].access_token;

    // Step 2: Handle the operation
    if (body.op === 'get') {
      // Look up the seller by user UUID (sellers.id = auth.users.id)
      const sellerResp = await fetch(
        `${SUPABASE_URL}/rest/v1/sellers?id=eq.${userId}&select=*`,
        { headers: serviceHeaders }
      );

      const sellerData = await sellerResp.json();
      if (sellerData && sellerData.length > 0) {
        return NextResponse.json({ success: true, seller: sellerData[0] });
      }
      return NextResponse.json({ success: true, seller: null });
    }

    if (body.op === 'update') {
      // UPSERT: Try to insert with the user's UUID as the ID.
      // If the seller already exists (ON CONFLICT), update instead.
      const sellerRecord: Record<string, any> = {
        id: userId,
        email: body.email || null,
        business_name: body.business_name || null,
        business_description: body.business_description || null,
        business_category: body.business_category || null,
        business_location: body.business_location || null,
        seller_type: body.seller_type || 'business',
        farm_name: body.farm_name || null,
        profile_image: body.profile_image || null,
        status: 'active',
        email_verified: true,
        updated_at: new Date().toISOString(),
      };

      // Use UPSERT via the REST API with Prefer: resolution=merge-duplicates
      const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/sellers`, {
        method: 'POST',
        headers: {
          ...serviceHeaders,
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(sellerRecord),
      });

      if (!upsertResp.ok) {
        const errText = await upsertResp.text();
        return NextResponse.json(
          { success: false, error: `Failed to save seller profile: ${errText.substring(0, 200)}` },
          { status: 500 }
        );
      }

      const upsertData = await upsertResp.json();
      if (upsertData && upsertData.length > 0) {
        return NextResponse.json({ success: true, seller: upsertData[0] });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: `Unknown operation: ${body.op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
