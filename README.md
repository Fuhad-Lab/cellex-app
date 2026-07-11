---
title: Cellex Web
emoji: 🛍️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Nigeria's #1 social commerce marketplace (Next.js)
---

# Cellex — Nigeria's #1 Social Commerce Marketplace

Next.js 16 (App Router) frontend for the Cellex platform — a Nigerian social ecommerce
marketplace with live shopping, group buys, AI-powered discovery, and unified WhatsApp + Telegram
cross-platform shopping.

## What's inside

- **Buyer flow**: home, product detail, cart, checkout, PalmPay bank-transfer payment, orders, wishlist, profile
- **Discovery**: categories, search, seller storefronts, video feed, trending, AI recommendations
- **Live shopping**: browse live sessions, watch with real-time chat, featured product buy
- **Group buys**: Pinduoduo-style group discounts unlocked at target count
- **Cross-platform**: link WhatsApp bot with unified cart, Telegram channel alerts
- **Seller center**: dashboard, product CRUD, orders, profile, go-live, product videos, 24h stories

## Architecture

- Frontend: Next.js 16 App Router + React + TypeScript + Tailwind CSS 4 + shadcn/ui
- Backend: 27 Supabase Edge Functions (Deno) — unchanged from prior phases
- Auth: HTTP-only cookies → `web_sessions` table → JWT verify in edge functions
- Payment: PalmPay bank transfer with Gmail-IMAP auto-verification (Render bot)
- AI: Qwen2.5-72B powering product recommendations and shopping assistant

## Deployment

This Space uses the **Docker SDK**. The Dockerfile:

1. Builds the Next.js app with `output: "standalone"`
2. Copies the standalone server + static assets to a slim Node 20 image
3. Serves on port **7860** (HF Spaces default)

## Environment variables (set in HF Space settings)

```
SUPABASE_URL=https://tcwdbokruvlizkxcpkzj.supabase.co
SUPABASE_ANON_KEY=...   (Supabase anon key)
SUPABASE_SERVICE_KEY=... (optional, only if you upload videos via web-server)
GMAIL_EMAIL=...         (optional, only if running payment verifier here)
GMAIL_APP_PASSWORD=...
```

> **Note**: Most existing edge functions, the payment verifier, and WhatsApp/Telegram bots
> are NOT run here — they continue running on Render / Supabase. This Space only hosts the
> Next.js web frontend.
