import { validateCsrf, csrfRejected } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : '';
const COOKIE_NAME = 'cellex_session_id';

/**
 * Payment API — routes ALL payment operations through the social Edge Function.
 *
 * SECURITY: The frontend NEVER sees Paystack keys. All Paystack calls
 * (initialize, verify, transfer, bank resolve) happen in the Edge Function
 * which has PAYSTACK_SECRET_KEY from Supabase Secrets.
 *
 * Operations:
 *   - get_banks:         List Nigerian banks (from Paystack)
 *   - get_bank_details:  Get seller's saved bank details
 *   - save_bank_details: Save + verify bank details via Paystack
 *   - initialize:        Start Paystack checkout
 *   - verify:            Verify payment + create escrow (3-day hold)
 *   - get_earnings:      Get seller's escrow balance + payout history
 *   - request_payout:    Seller withdraws available balance to bank account
 */
export async function POST(request: NextRequest) {
  const _sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  if (_sessionId && !validateCsrf(request)) return csrfRejected();
  if (!SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 500 });
  }

  const sessionId = request.cookies.get(COOKIE_NAME)?.value || '';
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const op = body.op;
  if (!op) return NextResponse.json({ success: false, error: 'op required' }, { status: 400 });

  // Map frontend ops to Edge Function ops
  const opMap: Record<string, string> = {
    'get_banks':         'payment_get_banks',
    'get_bank_details':  'payment_get_bank_details',
    'save_bank_details': 'payment_save_bank_details',
    'initialize':        'payment_initialize',
    'verify':            'payment_verify',
    'get_earnings':      'payment_get_earnings',
    'request_payout':    'payment_request_payout',
  };

  const edgeOp = opMap[op];
  if (!edgeOp) {
    // Fall back to old payment edge function for legacy ops
    return proxyToOldPayment(body, sessionId);
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
      body: JSON.stringify({ ...body, op: edgeOp }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: 'Invalid response' }; }
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Payment service unavailable' }, { status: 500 });
  }
}

async function proxyToOldPayment(body: any, sessionId: string) {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;

  try {
    const resp = await fetch(`${EDGE_FUNCTIONS_URL}/payment`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Payment service unavailable' }, { status: 500 });
  }
}
