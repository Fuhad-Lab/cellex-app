"""
Cellex Web Server (HTTP-Only Cookie Auth — Production Standard)
-----------------------------------------------------------------
Serves the Cellex frontend + proxies /api/* to Supabase Edge Functions.

Auth uses HTTP-ONLY COOKIES — the industry standard used by AliExpress,
Temu, Alibaba, Amazon, Gmail, Netflix, and every major website.

How it works:
  - Login: edge function creates session in web_sessions table → returns
    { session_id, user } → server sets session_id as HTTP-only cookie
    (JavaScript CANNOT read it) → strips session_id from response body
  - All requests: browser AUTOMATICALLY sends the cookie → server reads it
    → forwards as Authorization: Bearer <session_id> to edge functions
  - Edge function looks up session_id in web_sessions table → gets JWT
    tokens → verifies → identifies user
  - Logout: server clears cookie + edge function deletes session

Security:
  - HTTP-only: JavaScript CANNOT read the cookie (document.cookie returns nothing)
  - Secure: only sent over HTTPS
  - SameSite=Lax: CSRF protection
  - Max-Age=7 days: session persists across tabs, restarts, and 7 days
  - The cookie only contains a random UUID (session_id), NOT a JWT token
  - The actual JWT tokens live in Supabase web_sessions table
  - NO localStorage. NO sessionStorage. NO tokens in JavaScript.
"""

import httpx
import os
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cellex Web Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Configuration
# ============================================================================
SUPABASE_PROJECT_URL = os.environ.get(
    "SUPABASE_PROJECT_URL",
    "https://tcwdbokruvlizkxcpkzj.supabase.co"
)
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
EDGE_FUNCTIONS_URL = f"{SUPABASE_PROJECT_URL}/functions/v1"

STATIC_DIR = Path(__file__).resolve().parent.parent

# Cookie settings
COOKIE_NAME = "cellex_session_id"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds

logger.info(f"🚀 Cellex Web Server starting")
logger.info(f"📁 Static files: {STATIC_DIR}")
logger.info(f"🔒 Edge functions: {EDGE_FUNCTIONS_URL}")


# ============================================================================
# API PROXY — core forwarding logic
# ============================================================================

async def _proxy_to_edge_function(edge_name: str, request: Request):
    """Forward a request to a Supabase Edge Function.

    Reads the session_id from the HTTP-only cookie (NOT from JS headers)
    and forwards it as Authorization: Bearer <session_id>.

    The cookie is HTTP-only — JavaScript cannot read it. The browser
    automatically sends it with every same-origin request.
    """
    if not SUPABASE_ANON_KEY:
        return JSONResponse(
            {"success": False, "error": "SUPABASE_ANON_KEY not set on server"},
            status_code=500
        )

    # Read session_id from HTTP-only cookie (set during login)
    session_id = request.cookies.get(COOKIE_NAME, "")

    # Build outgoing headers for the edge function
    outgoing_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    if session_id:
        # Forward session_id as Bearer token — edge function looks it up
        # in the web_sessions table to get the actual JWT access_token
        outgoing_headers["Authorization"] = f"Bearer {session_id}"

    # Phase 4: forward X-Bot-Api-Key so the WhatsApp bot can call cross-platform endpoints
    # (used by the Render WhatsApp bot to add to cart, link accounts, etc.)
    bot_api_key = request.headers.get("X-Bot-Api-Key")
    if bot_api_key:
        outgoing_headers["X-Bot-Api-Key"] = bot_api_key

    # Phase 4: forward X-Internal-Call so edge functions can call each other (e.g. telegram broadcast)
    internal_call = request.headers.get("X-Internal-Call")
    if internal_call:
        outgoing_headers["X-Internal-Call"] = internal_call

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


# ============================================================================
# AUTH PROXY — handles cookie set/clear for login/logout
# ============================================================================

@app.post("/api/auth")
async def proxy_auth(request: Request):
    """Auth proxy with HTTP-only cookie management.

    - login/signup: edge function returns { session_id, user } → server sets
      session_id as HTTP-only cookie → strips session_id from response body
      (frontend only gets user object, never sees the session_id)
    - logout: clears the cookie + edge function deletes the session
    - session: reads cookie → forwards to edge function for verification

    The cookie is:
      - httponly=True  → JavaScript CANNOT read it (XSS-proof)
      - secure=True    → only sent over HTTPS
      - samesite='lax' → CSRF protection
      - max_age=7 days → persists across tabs, restarts, and 7 days
    """
    if not SUPABASE_ANON_KEY:
        return JSONResponse({"success": False, "error": "SUPABASE_ANON_KEY not set"}, status_code=500)

    # Read the request body ONCE
    body_bytes = await request.body()
    try:
        body = json.loads(body_bytes) if body_bytes else {}
    except Exception:
        body = {}

    op = body.get("op", "")

    # Build outgoing headers — read session_id from cookie (not from JS)
    outgoing_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    cookie_session_id = request.cookies.get(COOKIE_NAME, "")
    if cookie_session_id:
        outgoing_headers["Authorization"] = f"Bearer {cookie_session_id}"

    # Call the auth edge function directly
    target_url = f"{EDGE_FUNCTIONS_URL}/auth"
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(target_url, content=body_bytes, headers=outgoing_headers)
        data = resp.json()
    except Exception as e:
        logger.error(f"Auth proxy error: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    # Handle login/signup: set HTTP-only cookie with session_id
    if op in ("login", "signup") and isinstance(data, dict) and data.get("success"):
        session_id = data.get("session_id")

        # Strip session_id from the response body — frontend doesn't need it
        # (it's in the HTTP-only cookie which JS can't read anyway)
        response_data = {k: v for k, v in data.items() if k != "session_id"}
        response = JSONResponse(response_data, status_code=resp.status_code)

        if session_id:
            # Set HTTP-only cookie — JavaScript CANNOT read this
            response.set_cookie(
                key=COOKIE_NAME,
                value=session_id,
                httponly=True,        # ← JavaScript CANNOT read this cookie
                secure=True,          # ← HTTPS only
                samesite="lax",       # ← CSRF protection
                max_age=COOKIE_MAX_AGE,  # ← 7 days
                path="/"
            )
            logger.info(f"✅ Set HTTP-only cookie for session")

        return response

    # Handle logout: clear the cookie
    if op == "logout":
        response = JSONResponse(data, status_code=resp.status_code)
        response.delete_cookie(COOKIE_NAME, path="/")
        logger.info(f"✅ Cleared HTTP-only cookie")
        return response

    # Default (session check, etc.): return as-is
    return JSONResponse(data, status_code=resp.status_code)


# ============================================================================
# OTHER PROXY ROUTES (cookie auto-sent by browser, no special handling)
# ============================================================================

@app.post("/api/ai-chat")
async def proxy_ai_chat(request: Request):
    return await _proxy_to_edge_function("ai-chat", request)

@app.post("/api/cart")
async def proxy_cart(request: Request):
    return await _proxy_to_edge_function("cart", request)

@app.post("/api/products")
async def proxy_products(request: Request):
    return await _proxy_to_edge_function("products", request)

@app.post("/api/orders")
async def proxy_orders(request: Request):
    return await _proxy_to_edge_function("orders", request)

@app.post("/api/profile")
async def proxy_profile(request: Request):
    return await _proxy_to_edge_function("profile", request)

@app.post("/api/wishlist")
async def proxy_wishlist(request: Request):
    return await _proxy_to_edge_function("wishlist", request)

@app.post("/api/checkout")
async def proxy_checkout(request: Request):
    return await _proxy_to_edge_function("checkout", request)

# ---- Seller & Social Edge Functions (Phase 1) ----
@app.post("/api/seller-dashboard")
async def proxy_seller_dashboard(request: Request):
    return await _proxy_to_edge_function("seller-dashboard", request)

@app.post("/api/seller-products")
async def proxy_seller_products(request: Request):
    return await _proxy_to_edge_function("seller-products", request)

@app.post("/api/seller-orders")
async def proxy_seller_orders(request: Request):
    return await _proxy_to_edge_function("seller-orders", request)

@app.post("/api/seller-profile")
async def proxy_seller_profile(request: Request):
    return await _proxy_to_edge_function("seller-profile", request)

@app.post("/api/social")
async def proxy_social(request: Request):
    return await _proxy_to_edge_function("social", request)

# ---- Phase 2: Community Engagement ----
@app.post("/api/reviews")
async def proxy_reviews(request: Request):
    return await _proxy_to_edge_function("reviews", request)

@app.post("/api/group-buy")
async def proxy_group_buy(request: Request):
    return await _proxy_to_edge_function("group-buy", request)

@app.post("/api/wishlist-share")
async def proxy_wishlist_share(request: Request):
    return await _proxy_to_edge_function("wishlist-share", request)

@app.post("/api/live")
async def proxy_live(request: Request):
    return await _proxy_to_edge_function("live", request)

# ---- Phase 3: Content & Discovery ----
@app.post("/api/videos")
async def proxy_videos(request: Request):
    return await _proxy_to_edge_function("videos", request)

@app.post("/api/trending")
async def proxy_trending(request: Request):
    return await _proxy_to_edge_function("trending", request)

@app.post("/api/stories")
async def proxy_stories(request: Request):
    return await _proxy_to_edge_function("stories", request)

@app.post("/api/discover")
async def proxy_discover(request: Request):
    return await _proxy_to_edge_function("discover", request)

# ---- Phase 4: Cross-platform integration ----
@app.post("/api/cross-platform")
async def proxy_cross_platform(request: Request):
    return await _proxy_to_edge_function("cross-platform", request)

@app.post("/api/telegram")
async def proxy_telegram(request: Request):
    return await _proxy_to_edge_function("telegram", request)

# ---- Phase 4: OpenWA gateway proxy (avoids CORS issues from browser) ----
OPENWA_BASE_URL = os.environ.get("OPENWA_BASE_URL", "https://eesha-search.onrender.com")
OPENWA_API_KEY = os.environ.get("OPENWA_API_KEY", "CellexWA2024")

@app.api_route("/api/openwa/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_openwa(path: str, request: Request):
    """Proxy requests to the OpenWA gateway to avoid CORS issues.
    The browser can't call eesha-search.onrender.com directly due to CORS,
    so we proxy through here with the X-API-Key header injected server-side."""
    target_url = f"{OPENWA_BASE_URL}/{path}"
    
    # Forward query params
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    # Build headers — inject the API key
    headers = {
        "X-API-Key": OPENWA_API_KEY,
        "Content-Type": "application/json",
    }
    
    # Read body for POST/PUT
    body = None
    if request.method in ("POST", "PUT"):
        body = await request.body()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if request.method == "GET":
                resp = await client.get(target_url, headers=headers)
            elif request.method == "POST":
                resp = await client.post(target_url, content=body, headers=headers)
            elif request.method == "PUT":
                resp = await client.put(target_url, content=body, headers=headers)
            elif request.method == "DELETE":
                resp = await client.delete(target_url, headers=headers)
            else:
                return JSONResponse({"error": "Method not allowed"}, status_code=405)
        
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:500]}
        return JSONResponse(data, status_code=resp.status_code)
    except httpx.TimeoutException:
        return JSONResponse({"error": "OpenWA gateway timeout"}, status_code=504)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ---- Phase 3: Direct video upload to Supabase Storage ----
# Sellers upload video files via PUT. The web-server reads the session cookie
# to verify auth, then forwards the bytes to Supabase Storage using the
# service role key (which the frontend never sees).
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

@app.put("/api/video-upload/{seller_id}/{product_id}/{filename}")
async def upload_video(seller_id: str, product_id: str, filename: str, request: Request):
    """Receive a video file from the seller and store it in Supabase Storage.

    The seller's browser PUTs the raw video bytes here. We verify the session
    cookie matches seller_id, then forward to Supabase Storage using the
    service role key (which the browser never sees).
    """
    if not SUPABASE_SERVICE_KEY:
        return JSONResponse({"success": False, "error": "SUPABASE_SERVICE_ROLE_KEY not set"}, status_code=500)

    # Verify the seller's session cookie
    session_id = request.cookies.get(COOKIE_NAME, "")
    if not session_id:
        return JSONResponse({"success": False, "error": "Not authenticated"}, status_code=401)

    # Look up the session to get the user_id
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            sess_resp = await client.get(
                f"{SUPABASE_PROJECT_URL}/rest/v1/web_sessions?select=user_id,expires_at&session_id=eq.{session_id}&limit=1",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                }
            )
            sess_data = sess_resp.json()
            if not sess_data or len(sess_data) == 0:
                return JSONResponse({"success": False, "error": "Invalid session"}, status_code=401)
            expires_at = sess_data[0].get("expires_at", "")
            try:
                exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).replace(tzinfo=None)
                if exp < datetime.utcnow():
                    return JSONResponse({"success": False, "error": "Session expired"}, status_code=401)
            except Exception:
                pass  # If parsing fails, don't block — let it through
            user_id = sess_data[0].get("user_id")
            if user_id != seller_id:
                return JSONResponse({"success": False, "error": "Not authorized"}, status_code=403)
    except Exception as e:
        logger.error(f"Video upload auth check failed: {e}")
        return JSONResponse({"success": False, "error": "Auth check failed"}, status_code=500)

    # Sanitize filename and build storage path
    safe_filename = "".join(c for c in filename if c.isalnum() or c in ".-_")
    if not safe_filename:
        return JSONResponse({"success": False, "error": "Invalid filename"}, status_code=400)
    storage_path = f"{seller_id}/{product_id}/{int(time.time() * 1000)}-{safe_filename}"

    # Read the raw body
    body_bytes = await request.body()
    if len(body_bytes) > 50 * 1024 * 1024:  # 50MB limit
        return JSONResponse({"success": False, "error": "File too large (max 50MB)"}, status_code=413)

    content_type = request.headers.get("content-type", "video/mp4")

    # Forward to Supabase Storage
    storage_url = f"{SUPABASE_PROJECT_URL}/storage/v1/object/product-videos/{storage_path}"
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.put(
                storage_url,
                content=body_bytes,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": content_type,
                    "x-upsert": "false",
                }
            )
        if resp.status_code >= 400:
            return JSONResponse({"success": False, "error": f"Storage error: {resp.text}"}, status_code=500)
    except Exception as e:
        logger.error(f"Video upload to storage failed: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    public_url = f"{SUPABASE_PROJECT_URL}/storage/v1/object/public/product-videos/{storage_path}"
    return JSONResponse({"success": True, "url": public_url, "path": storage_path})

@app.get("/api/health")
async def proxy_health():
    return {
        "success": True,
        "proxy": "active",
        "edge_functions_url_configured": bool(SUPABASE_PROJECT_URL),
        "anon_key_configured": bool(SUPABASE_ANON_KEY),
    }


# ============================================================================
# STATIC FILE SERVING
# ============================================================================

SENSITIVE_PREFIXES = (
    "telegram-bot", "supabase", "web-server", ".git", "node_modules",
    ".env", "skills", "mini-services", "eeshamart-ai-backend",
    "eeshamart-ai-space", "eeshamart-ai-clean", "eeshamart-ai-fresh",
    "eeshamart-ai-hf", "eesha-ai", "netlify", "upload", "src", "prisma",
    "dist", ".next", "worklog.md", ".gitignore", "README.md", "bun.lock",
    "EeshaShop.zip",
)

@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

@app.get("/{filename:path}")
async def serve_static(filename: str):
    if filename.startswith(SENSITIVE_PREFIXES) or filename == "":
        if filename == "":
            return await serve_index()
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    file_path = STATIC_DIR / filename

    try:
        file_path.resolve().relative_to(STATIC_DIR)
    except ValueError:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if file_path.is_file():
        return FileResponse(file_path)

    if "." not in filename.split("/")[-1]:
        index_path = STATIC_DIR / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)

    return JSONResponse({"detail": "Not Found"}, status_code=404)

if __name__ == "__main__":
    import uvicorn
    import asyncio
    import logging
    
    logger = logging.getLogger("cellex-web")
    logging.basicConfig(level=logging.INFO)
    
    # ---- Keep Render services alive (ping every 4 minutes) ----
    # Render free tier sleeps after 15 min of inactivity.
    # The HF Space runs 24/7, so it can keep both Render services awake.
    GATEWAY_URL = os.environ.get("GATEWAY_PING_URL", "https://eesha-search.onrender.com")
    BOT_URL = os.environ.get("BOT_PING_URL", "https://eesha-shop-buying-and-selling.onrender.com")
    
    async def keep_services_alive():
        """Ping both Render services every 4 minutes to prevent sleeping."""
        while True:
            for name, url in [("gateway", GATEWAY_URL), ("bot", BOT_URL)]:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(url)
                    logger.info(f"🔄 Ping {name}: HTTP {resp.status_code}")
                except Exception as e:
                    logger.warning(f"🔄 Ping {name} failed: {e}")
            await asyncio.sleep(240)  # 4 minutes
    
    # Start the ping task
    config = uvicorn.Config(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
    server = uvicorn.Server(config)
    
    # Run both uvicorn and the ping task
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.create_task(keep_services_alive())
    loop.run_until_complete(server.serve())
