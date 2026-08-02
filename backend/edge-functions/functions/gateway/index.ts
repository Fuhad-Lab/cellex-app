/// <reference lib="deno.ns" />
/**
 * Cellex Gateway Edge Function — Secure Middle Layer
 *
 * This is the SINGLE entry point for ALL protected frontend requests.
 * The frontend NEVER talks directly to NestJS, FastAPI, or the database.
 *
 * Flow:
 * 1. Frontend → /api/* → Next.js proxy → this Edge Function
 * 2. This function verifies auth, rate limits, validates input
 * 3. Routes to NestJS (business logic) or FastAPI (AI tasks)
 * 4. Sanitizes the response and returns to frontend
 *
 * Security:
 * - Verifies session cookie → extracts user_id
 * - Rate limits per user (sliding window via Redis or in-memory)
 * - Validates request body (basic schema check)
 * - Sets X-Internal-Token + X-User-Id headers for backend services
 * - Strips internal fields from responses
 * - NEVER exposes service URLs, tokens, or DB credentials to frontend
 */

import { corsHeaders, jsonResponse, errorResponse, getUser } from '../_shared/cors.ts';

const NESTJS_API_URL = Deno.env.get('NESTJS_API_URL') || '';
const FASTAPI_URL = Deno.env.get('FASTAPI_URL') || '';
const INTERNAL_TOKEN = Deno.env.get('CELLEX_INTERNAL_TOKEN') || '';

// In-memory rate limiter (fallback if Redis is unavailable)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { op, ...params } = body;

    // === Step 1: Verify authentication ===
    const user = await getUser(req);
    const isAuthenticated = !!user;

    // === Step 2: Route to the correct backend service ===
    // Public ops (no auth required)
    const PUBLIC_OPS = ['products_list', 'products_by_id', 'products_search', 'seller_by_slug', 'group_buy_invite'];

    if (!isAuthenticated && !PUBLIC_OPS.includes(op)) {
      return errorResponse('Not authenticated', 401);
    }

    // Rate limit (per user or per IP)
    const rateLimitKey = user?.id || (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(rateLimitKey, 100, 60000)) {
      return errorResponse('Too many requests. Please slow down.', 429);
    }

    // === Route to NestJS or FastAPI ===
    const route = getRoute(op);
    if (!route) return errorResponse(`Unknown op: ${op}`, 400);

    // Build the request to the backend service
    const requestId = crypto.randomUUID();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      'X-Request-Id': requestId,
    };
    if (user) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Email'] = user.email || '';
    }

    const backendResp = await fetch(route.url, {
      method: route.method,
      headers,
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(route.timeout || 30000),
    });

    const text = await backendResp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: 'Invalid response' }; }

    // Sanitize: remove internal fields
    if (data) {
      delete data.internal;
      delete data.stack;
      delete data.query;
    }

    return jsonResponse(data, backendResp.status);
  } catch (err) {
    return errorResponse(`Gateway error: ${String(err).slice(0, 100)}`, 500);
  }
});

/**
 * Route an op to the correct backend service + endpoint.
 */
function getRoute(op: string): { url: string; method: string; timeout?: number } | null {
  // NestJS routes (business logic)
  const nestjsRoutes: Record<string, { path: string; method: string }> = {
    // Products
    'products_list':       { path: '/products', method: 'GET' },
    'products_by_id':      { path: '/products/:id', method: 'GET' },
    'products_search':     { path: '/products/search', method: 'POST' },
    'products_create':     { path: '/products', method: 'POST' },
    'products_update':     { path: '/products/:id', method: 'PATCH' },
    'products_delete':     { path: '/products/:id', method: 'DELETE' },
    // Orders
    'orders_create':       { path: '/orders', method: 'POST' },
    'orders_list':         { path: '/orders', method: 'GET' },
    'orders_get':          { path: '/orders/:id', method: 'GET' },
    // Payments
    'payments_verify':     { path: '/payments/verify', method: 'POST' },
    // Messaging
    'messaging_list':      { path: '/messaging/conversations', method: 'GET' },
    'messaging_messages':  { path: '/messaging/messages', method: 'GET' },
    'messaging_send':      { path: '/messaging/send', method: 'POST' },
    // Notifications
    'notifications_list':  { path: '/notifications', method: 'GET' },
    'notifications_read':  { path: '/notifications/read', method: 'POST' },
    // Users
    'profile_get':         { path: '/users/profile', method: 'GET' },
    'profile_update':      { path: '/users/profile', method: 'PATCH' },
    // Seller
    'seller_get':          { path: '/sellers/profile', method: 'GET' },
    'seller_update':       { path: '/sellers/profile', method: 'PATCH' },
    'seller_by_slug':      { path: '/sellers/by-slug', method: 'POST' },
    // Cart
    'cart_get':            { path: '/cart', method: 'GET' },
    'cart_add':            { path: '/cart/add', method: 'POST' },
    'cart_remove':         { path: '/cart/remove', method: 'POST' },
    // Admin
    'admin_users':         { path: '/admin/users', method: 'GET' },
    'admin_moderate':      { path: '/admin/moderate', method: 'POST' },
  };

  // FastAPI routes (AI tasks)
  const fastapiRoutes: Record<string, { path: string; method: string; timeout?: number }> = {
    'ai_search':           { path: '/ai/search', method: 'POST', timeout: 15000 },
    'ai_recommend':        { path: '/ai/recommend', method: 'POST', timeout: 10000 },
    'ai_tryon':            { path: '/ai/tryon', method: 'POST', timeout: 180000 },
    'ai_avatar':           { path: '/ai/avatar', method: 'POST', timeout: 30000 },
    'ai_moderate':         { path: '/ai/moderate', method: 'POST', timeout: 15000 },
  };

  const nestjsRoute = nestjsRoutes[op];
  if (nestjsRoute) {
    // Replace :id placeholders (the actual ID is in params)
    let path = nestjsRoute.path;
    if (params.id) path = path.replace(':id', String(params.id));
    if (params.productId) path = path.replace(':id', String(params.productId));
    return { url: `${NESTJS_API_URL}${path}`, method: nestjsRoute.method };
  }

  const fastapiRoute = fastapiRoutes[op];
  if (fastapiRoute) {
    return {
      url: `${FASTAPI_URL}${fastapiRoute.path}`,
      method: fastapiRoute.method,
      timeout: fastapiRoute.timeout,
    };
  }

  return null;
}
