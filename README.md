---
title: Cellex Web
emoji: 🛒
colorFrom: yellow
colorTo: red
sdk: docker
pinned: false
license: apache-2.0
short_description: Cellex - Nigeria's #1 Marketplace
---

# Cellex Web Server

Serves the Cellex frontend (static files) + proxies `/api/*` requests to Supabase Edge Functions.

## Architecture

```
Browser → cellex-web.hf.space → web-server/server.py
                                ├── /api/* → Supabase Edge Functions (with anon key from env)
                                └── /* → static files (index.html, ai-chat.html, js/, etc.)
```

The frontend has **ZERO** Supabase references — no URL, no keys, no SDK. All requests go through relative `/api/*` URLs.

## Environment Variables (set as Secrets)

| Key | Value |
|-----|-------|
| `SUPABASE_PROJECT_URL` | `https://tcwdbokruvlizkxcpkzj.supabase.co` |
| `SUPABASE_ANON_KEY` | (Supabase anon key) |
| `PORT` | `7860` |
