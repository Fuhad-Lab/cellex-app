"""
EeshaMart Web Server
--------------------
Serves the EeshaMart frontend (static files) + proxies /api/* requests
to Supabase Edge Functions.

This runs as a SEPARATE Render service from the Telegram bot.
The Telegram bot has its own Render project.

Environment variables (set these on Render):
  SUPABASE_PROJECT_URL  - e.g. https://tcwdbokruvlizkxcpkzj.supabase.co
  SUPABASE_ANON_KEY     - the Supabase anon key (safe for server-side use)
  PORT                  - Render sets this automatically

The frontend (index.html, ai-chat.html, js/, etc.) has ZERO Supabase
references. All requests go through relative /api/* URLs which this
server proxies to Supabase with the anon key from env vars.

Deploy on Render:
  - Type: Web Service
  - Build Command: pip install -r web-server/requirements.txt
  - Start Command: python web-server/server.py
  - Working Directory: repo root (so it can serve static files)
"""

import httpx
import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EeshaMart Web Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Configuration (from environment variables — NOT in frontend code)
# ============================================================================
SUPABASE_PROJECT_URL = os.environ.get(
    "SUPABASE_PROJECT_URL",
    "https://tcwdbokruvlizkxcpkzj.supabase.co"
)
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
EDGE_FUNCTIONS_URL = f"{SUPABASE_PROJECT_URL}/functions/v1"

# Static files directory = repo root (parent of web-server/)
STATIC_DIR = Path(__file__).resolve().parent.parent

logger.info(f"🚀 EeshaMart Web Server starting")
logger.info(f"📁 Static files: {STATIC_DIR}")
logger.info(f"🔒 Edge functions: {EDGE_FUNCTIONS_URL}")
logger.info(f"🔑 Anon key configured: {bool(SUPABASE_ANON_KEY)}")


# ============================================================================
# API PROXY ROUTES
# ----------------------------------------------------------------------------
# The frontend calls these relative URLs. This proxy forwards to Supabase
# Edge Functions, injecting the Supabase URL + anon key from env vars.
#
# This means:
#   - Frontend has ZERO Supabase references (no URL, no keys, no SDK)
#   - If someone clones the site with HTTrack, they only see /api/* URLs
#   - The Supabase URL and anon key live only in this server's env vars
# ============================================================================

async def _proxy_to_edge_function(edge_name: str, request: Request):
    """Forward a request to a Supabase Edge Function.

    Injects:
      - Authorization: Bearer <user_token>  (passed through from frontend)
      - apikey: <SUPABASE_ANON_KEY>  (from env var — never in frontend)
    """
    if not SUPABASE_ANON_KEY:
        return JSONResponse(
            {"success": False, "error": "SUPABASE_ANON_KEY not set on server"},
            status_code=500
        )

    # Get session_id from the X-Session-Id header (sent by frontend, stored in memory)
    session_id = request.headers.get("X-Session-Id", "")

    # Build outgoing headers for the edge function
    outgoing_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    if session_id:
        # Send session_id as Bearer token — edge function will look it up
        # in the web_sessions table to get the actual access_token
        outgoing_headers["Authorization"] = f"Bearer {session_id}"

    # Read the request body
    try:
        body = await request.body()
    except Exception:
        body = b"{}"

    target_url = f"{EDGE_FUNCTIONS_URL}/{edge_name}"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                target_url,
                content=body,
                headers=outgoing_headers,
            )

        # Return the edge function's response as-is
        try:
            data = resp.json()
        except Exception:
            data = {"success": False, "error": f"Edge function returned non-JSON: {resp.text[:200]}"}

        return JSONResponse(data, status_code=resp.status_code)

    except httpx.TimeoutException:
        return JSONResponse({"success": False, "error": "Request timed out"}, status_code=504)
    except Exception as e:
        logger.error(f"Proxy error to {edge_name}: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


# ---- Proxy routes for each edge function ----

@app.post("/api/ai-chat")
async def proxy_ai_chat(request: Request):
    """Proxy for AI chat. Frontend calls POST /api/ai-chat."""
    return await _proxy_to_edge_function("ai-chat", request)


@app.post("/api/cart")
async def proxy_cart(request: Request):
    """Proxy for cart operations. Frontend calls POST /api/cart."""
    return await _proxy_to_edge_function("cart", request)


@app.post("/api/products")
async def proxy_products(request: Request):
    """Proxy for product queries. Frontend calls POST /api/products."""
    return await _proxy_to_edge_function("products", request)


@app.post("/api/auth")
async def proxy_auth(request: Request):
    """Proxy for auth operations. Frontend calls POST /api/auth.
    Session-based: frontend sends X-Session-Id header, no cookies."""
    return await _proxy_to_edge_function("auth", request)


@app.get("/api/health")
async def proxy_health():
    """Health check for the proxy."""
    return {
        "success": True,
        "proxy": "active",
        "edge_functions_url_configured": bool(SUPABASE_PROJECT_URL),
        "anon_key_configured": bool(SUPABASE_ANON_KEY),
    }


# ============================================================================
# STATIC FILE SERVING
# ----------------------------------------------------------------------------
# Serve the frontend HTML/CSS/JS files from the repo root.
# This is a SEPARATE service from the Telegram bot.
# ============================================================================

# Sensitive directories that should NEVER be served
SENSITIVE_PREFIXES = (
    "telegram-bot",
    "supabase",
    "web-server",
    ".git",
    "node_modules",
    ".env",
    "skills",
    "mini-services",
    "eeshamart-ai-backend",
    "eeshamart-ai-space",
    "eeshamart-ai-clean",
    "eeshamart-ai-fresh",
    "eeshamart-ai-hf",
    "eesha-ai",
    "netlify",
    "upload",
    "src",
    "prisma",
    "dist",
    ".next",
    "worklog.md",
    ".gitignore",
    "README.md",
    "bun.lock",
    "EeshaShop.zip",
)


@app.get("/")
async def serve_index():
    """Serve the main index.html"""
    index_path = STATIC_DIR / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found"}, status_code=404)


@app.get("/{filename:path}")
async def serve_static(filename: str):
    """Serve static files from the repo root.

    - Blocks sensitive directories (telegram-bot, supabase, .git, etc.)
    - Falls back to index.html for client-side routing
    - Security: ensures resolved path is within STATIC_DIR
    """
    # Block sensitive paths
    if filename.startswith(SENSITIVE_PREFIXES) or filename == "":
        if filename == "":
            return await serve_index()
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    file_path = STATIC_DIR / filename

    # Security: ensure the resolved path is within STATIC_DIR (prevent path traversal)
    try:
        file_path.resolve().relative_to(STATIC_DIR)
    except ValueError:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if file_path.is_file():
        return FileResponse(file_path)

    # Fallback to index.html for client-side routing (e.g. /ai-chat would 404 otherwise)
    # But only for paths that look like routes (no file extension)
    if "." not in filename.split("/")[-1]:
        index_path = STATIC_DIR / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)

    return JSONResponse({"detail": "Not Found"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
