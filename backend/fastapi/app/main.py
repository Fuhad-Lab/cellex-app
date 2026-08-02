"""Cellex AI Service — FastAPI"""

import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Cellex AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Internal token verification
INTERNAL_TOKEN = os.getenv("CELLEX_INTERNAL_TOKEN", "")

@app.middleware("http")
async def verify_token(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    token = request.headers.get("x-internal-token", "")
    if not INTERNAL_TOKEN or token != INTERNAL_TOKEN:
        return JSONResponse(status_code=401, content={"error": "Invalid request source"})
    request.state.user_id = request.headers.get("x-user-id", "")
    return await call_next(request)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "cellex-ai", "version": "1.0.0"}

# === AI Search ===
@app.post("/ai/search")
async def search(request: Request):
    import json
    body = await request.body()
    data = json.loads(body) if body else {}
    query = data.get("query", "")
    limit = data.get("limit", 20)

    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
    NESTJS_API_URL = os.getenv("NESTJS_API_URL", "")

    # Generate embedding via NVIDIA
    embedding = []
    if NVIDIA_API_KEY and query:
        try:
            import urllib.request
            req_data = json.dumps({
                "model": "nvidia/nv-embedqa-e5-v5",
                "input": query,
                "input_type": "query",
                "encoding_format": "float",
            }).encode()
            req = urllib.request.Request(
                "https://integrate.api.nvidia.com/v1/embeddings",
                data=req_data,
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                embedding = result.get("data", [{}])[0].get("embedding", [])
        except Exception as e:
            logger.warning(f"Embedding failed: {e}")

    # Search via Edge Function (pgvector)
    if embedding:
        try:
            EDGE_URL = os.getenv("SUPABASE_URL", "https://tcwdbokruvlizkxcpkzj.supabase.co") + "/functions/v1"
            import urllib.request
            req_data = json.dumps({"op": "pgvector_search", "embedding": embedding, "limit": limit}).encode()
            req = urllib.request.Request(
                f"{EDGE_URL}/social",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
                product_ids = [r["id"] for r in result.get("results", [])]

            if product_ids and NESTJS_API_URL:
                req_data = json.dumps({"ids": [int(p) for p in product_ids]}).encode()
                req = urllib.request.Request(
                    f"{NESTJS_API_URL}/products/by-ids",
                    data=req_data,
                    headers={"X-Internal-Token": INTERNAL_TOKEN, "Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    result = json.loads(resp.read())
                    return {"success": True, "products": result.get("products", []), "source": "nvidia-pgvector"}
        except Exception as e:
            logger.warning(f"Search fallback: {e}")

    # Fallback: text search via NestJS
    if NESTJS_API_URL:
        try:
            import urllib.request
            req_data = json.dumps({"query": query, "limit": limit}).encode()
            req = urllib.request.Request(
                f"{NESTJS_API_URL}/products/search",
                data=req_data,
                headers={"X-Internal-Token": INTERNAL_TOKEN, "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
                return {"success": True, "products": result.get("products", []), "source": "text-fallback"}
        except:
            pass

    return {"success": True, "products": [], "source": "empty"}

# === AI Recommend ===
@app.post("/ai/recommend")
async def recommend(request: Request):
    import json
    body = await request.body()
    data = json.loads(body) if body else {}
    user_id = data.get("userId", "")
    limit = data.get("limit", 20)

    GORSE_URL = os.getenv("GORSE_URL", "")
    NESTJS_API_URL = os.getenv("NESTJS_API_URL", "")

    # Try Gorse
    if GORSE_URL:
        try:
            import urllib.request
            req = urllib.request.Request(f"{GORSE_URL}/api/recommend/{user_id}?n={limit}")
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
                item_ids = result.get("Items", [])
                if item_ids and NESTJS_API_URL:
                    req_data = json.dumps({"ids": [int(i) for i in item_ids[:limit]]}).encode()
                    req = urllib.request.Request(
                        f"{NESTJS_API_URL}/products/by-ids",
                        data=req_data,
                        headers={"X-Internal-Token": INTERNAL_TOKEN, "Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        result = json.loads(resp.read())
                        return {"success": True, "products": result.get("products", []), "source": "gorse"}
        except:
            pass

    # Fallback: trending via NestJS
    if NESTJS_API_URL:
        try:
            import urllib.request
            req = urllib.request.Request(f"{NESTJS_API_URL}/products/trending?limit={limit}")
            req.add_header("X-Internal-Token", INTERNAL_TOKEN)
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
                return {"success": True, "products": result.get("products", []), "source": "trending-fallback"}
        except:
            pass

    return {"success": True, "products": [], "source": "empty"}

# === AI Avatar (TTS) ===
@app.post("/ai/avatar")
async def avatar(request: Request):
    import json, base64
    body = await request.body()
    data = json.loads(body) if body else {}
    script = data.get("script", "")
    seller_id = data.get("sellerId", "")

    ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")
    audio_url = ""

    if ZAI_API_KEY and script:
        try:
            import urllib.request
            req_data = json.dumps({"model": "glm-4-voice", "input": script.strip(), "voice": "alloy"}).encode()
            req = urllib.request.Request(
                "https://api.z.ai/api/paas/v4/audios/speech",
                data=req_data,
                headers={"Authorization": f"Bearer {ZAI_API_KEY}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                audio_data = resp.read()
                audio_b64 = base64.b64encode(audio_data).decode()
                audio_url = f"data:audio/mpeg;base64,{audio_b64}"
        except Exception as e:
            logger.warning(f"TTS failed: {e}")

    return {"success": True, "audioUrl": audio_url, "language": data.get("language", "en")}

# === AI Try-On ===
@app.post("/ai/tryon")
async def tryon(request: Request):
    return {"success": False, "error": "Try-on is handled by the Edge Function directly"}

# === AI Moderate ===
@app.post("/ai/moderate")
async def moderate(request: Request):
    return {"success": True, "approved": True, "reason": "Auto-approved"}
