# Cellex Backend Architecture — Production-Grade, Security-First

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Public)                             │
│                   Next.js + TypeScript (Render)                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  NO SECRETS. NO service_role key. NO direct DB access.     │    │
│  │  Only talks to Supabase Edge Functions (via /api/* proxy).  │    │
│  │  Auth via httpOnly cookie (cellex_session_id).              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS only
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Middle Layer)                  │
│         Secure gateway — validates EVERY request                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  auth    │ │ gateway  │ │ products │ │  orders  │ │ payments │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │             │      │
│  ┌────▼─────────────▼────────────▼─────────────▼────────────▼────┐ │
│  │  Common middleware:                                            │ │
│  │  1. Verify session (auth)    2. Rate limit (per user/IP)      │ │
│  │  3. Validate input (Zod-like) 4. Check ownership/permissions  │ │
│  │  5. Route to NestJS or FastAPI  6. Sanitize response          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────┬───────────────────────────────┬───────────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────┐        ┌─────────────────────────┐
|  NESTJS API (Render) |        |  FASTAPI AI (Render)     |
|  Core business logic  |        |  AI tasks only           |
|                       |        |                          |
|  • Auth & sessions    |        |  • Semantic search       |
|  • User profiles      |        |  • Recommendations       |
|  • Products & stock   |        |  • Virtual try-on        |
|  • Orders & checkout  |        |  • Image moderation      |
|  • Payment verify     |        |  • Seller avatar TTS     |
|  • Messaging/chat     |        |  • Feed ranking          |
|  • Notifications      |        |                          |
|  • Admin/moderation   |        |  No DB access — calls     |
|  • Audit logging      |        |  NestJS API for data     |
|                       |        |                          |
|  Port: 3001           |        |  Port: 3002              |
└──────────┬────────────┘        └───────────┬─────────────┘
           │                                 │
           ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRES (Database)                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │   users    │ │  sellers   │ │  products  │ │  orders        │  │
│  │  profiles  │ │  follows   │ │  reviews   │ │  order_items   │  │
│  │  feed_posts│ │  comments  │ │  cart      │ │  payments      │  │
│  │  convos    │ │  messages  │ │  notifs    │ │  group_buys    │  │
│  │  audit_log │ │  reports   │ │            │ │                │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│                                                                     │
│  RLS on EVERY table. Service role key ONLY in Edge Functions.      │
│  Anon key has zero privileges (RLS denies all).                    │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SUPABASE STORAGE (Media)                               │
│  Product images, profile photos, chat media, video posts.           │
│  Upload via server-side signed URLs only.                           │
│  Public read for product/feed images. Private for chat media.       │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              REDIS (Render or Upstash)                               │
│  • Rate limiting (sliding window per user/IP)                       │
│  • Job queues (payment verification, video processing)              │
│  • Cache (product listings, recommendations)                        │
│  • Session blacklist (for logout)                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Request Flow (Example: Create Order)

```
1. Frontend → POST /api/orders { items: [...], shipping: {...} }
2. Next.js /api/orders → proxies to Edge Function "gateway"
3. Edge Function "gateway":
   a. Verify session cookie → get user_id
   b. Rate limit check (10 orders/min/user)
   c. Validate input (items array, shipping fields)
   d. Forward to NestJS: POST https://nestjs-api.onrender.com/orders
      with Authorization: Bearer <internal-service-token>
4. NestJS /orders:
   a. Verify internal service token (shared secret with Edge Functions)
   b. Verify user_id from header (set by Edge Function)
   c. Check product stock + prices from DB (NEVER trust client prices)
   d. Create order in DB with RLS (service role)
   e. Return order_id + payment instructions
5. Edge Function: sanitize response (remove internal fields)
6. Frontend: receives { orderId, total, paymentInfo }
```

## Security Layers (Defense in Depth)

```
Layer 1: Frontend (public, zero trust)
  → No secrets, no direct DB, no privileged calls

Layer 2: Edge Functions (gateway, validates everything)
  → Session verification, rate limiting, input validation
  → Ownership checks, authorization
  → Routes to correct backend service

Layer 3: NestJS / FastAPI (business logic)
  → Internal service token verification
  → Server-side price/stock verification
  → Payment verification (server-to-server)
  → Audit logging

Layer 4: Supabase RLS (database-level)
  → Even if a service is compromised, RLS prevents cross-user access
  → Service role bypasses RLS (only in Edge Functions)

Layer 5: Supabase Storage (media)
  → Server-side signed URLs for uploads
  → Public read bucket for product images
  → Private bucket for chat media (authenticated access only)
```

## Folder Structure

```
backend/
├── nestjs/                    # Core API (NestJS + TypeScript)
│   ├── src/
│   │   ├── main.ts            # App bootstrap
│   │   ├── app.module.ts      # Root module
│   │   ├── auth/              # Session verification, JWT
│   │   ├── users/             # User profiles
│   │   ├── products/          # Products, stock, pricing
│   │   ├── orders/            # Orders, checkout
│   │   ├── payments/          # Payment verification
│   │   ├── messaging/         # Chat, conversations
│   │   ├── notifications/     # Push/in-app notifications
│   │   ├── admin/             # Admin tools, moderation
│   │   ├── audit/             # Audit logging
│   │   ├── uploads/           # Media upload handlers
│   │   └── common/            # Guards, interceptors, filters
│   ├── test/                  # Unit + e2e tests
│   ├── Dockerfile             # Production build
│   └── package.json
│
├── fastapi/                   # AI Service (Python + FastAPI)
│   ├── app/
│   │   ├── main.py            # App bootstrap
│   │   ├── routers/           # API endpoints
│   │   │   ├── search.py      # Semantic search
│   │   │   ├── recommend.py   # Recommendations
│   │   │   ├── tryon.py       # Virtual try-on
│   │   │   ├── avatar.py      # Seller avatar TTS
│   │   │   └── moderate.py    # Image moderation
│   │   ├── services/          # Business logic
│   │   └── models/            # Pydantic models
│   ├── Dockerfile
│   └── requirements.txt
│
├── edge-functions/            # Supabase Edge Functions (Deno)
│   └── functions/
│       ├── gateway/           # Main gateway — routes all requests
│       ├── auth/              # Login, signup, session
│       └── _shared/           # CORS, auth utils, rate limiter
│
├── database/                  # SQL migrations + RLS policies
│   ├── migrations/            # Schema changes
│   └── policies/              # RLS policies
│
├── deploy/                    # Deployment configs
│   ├── render.yaml            # Render service definitions
│   └── docker-compose.yml     # Local dev
│
└── tests/                     # Integration tests
    ├── test_auth.py
    ├── test_orders.py
    ├── test_payments.py
    └── test_uploads.py
```

## API Contract

### Frontend → Edge Functions

All frontend requests go to `/api/*` which proxies to Edge Functions:

| Frontend Route | Edge Function | NestJS Endpoint | Method |
|---|---|---|---|
| /api/auth | auth | — (handled by edge) | POST |
| /api/products | gateway | GET /products | GET/POST |
| /api/orders | gateway | POST /orders | POST |
| /api/payments | gateway | POST /payments/verify | POST |
| /api/messenger | gateway | GET/POST /messaging | GET/POST |
| /api/notifications | gateway | GET/POST /notifications | GET/POST |
| /api/ai-search | gateway | — | POST → FastAPI |
| /api/try-on | gateway | — | POST → FastAPI |

### Edge Functions → NestJS

Internal communication uses a shared service token:

```
Authorization: Bearer <CELLEX_INTERNAL_TOKEN>
X-User-Id: <authenticated user UUID>
X-Request-Id: <trace ID for audit>
```

### Edge Functions → FastAPI

Same internal token pattern. FastAPI has NO database access — it calls NestJS for data.

## Environment Variables

### Supabase Secrets (NEVER on Render or frontend):
```
SUPABASE_URL                    # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY       # Service role key (admin access)
CELLEX_INTERNAL_TOKEN           # Shared token for edge→backend auth
NESTJS_API_URL                  # https://cellex-nestjs.onrender.com
FASTAPI_URL                     # https://cellex-ai.onrender.com
REDIS_URL                       # Redis connection string
NVIDIA_API_KEY                  # For embeddings
ZAI_API_KEY                     # For TTS
PAYSTACK_SECRET_KEY             # Payment verification
PAYSTACK_PUBLIC_KEY             # Payment initialization
```

### Render Environment (NestJS):
```
PORT=3001
SUPABASE_URL=<from Supabase Secrets>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Secrets>
CELLEX_INTERNAL_TOKEN=<from Supabase Secrets>
REDIS_URL=<from Supabase Secrets>
PAYSTACK_SECRET_KEY=<from Supabase Secrets>
NODE_ENV=production
```

### Render Environment (FastAPI):
```
PORT=3002
NESTJS_API_URL=<from Supabase Secrets>
CELLEX_INTERNAL_TOKEN=<from Supabase Secrets>
NVIDIA_API_KEY=<from Supabase Secrets>
ZAI_API_KEY=<from Supabase Secrets>
```

### Frontend (Next.js on Render):
```
NEXT_PUBLIC_SUPABASE_URL=<public URL, no key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key, RLS denies all>
```
NO service role key. NO internal token. NO payment secret.
