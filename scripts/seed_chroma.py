#!/usr/bin/env python3
"""
Seed Chroma Vector DB with product embeddings from NVIDIA NIM.

Uses Chroma v1 API (this deployment does not expose v2 endpoints):
- POST /api/v1/collections  {"name":"..."}  -> returns {id, name}
- POST /api/v1/collections/{id}/add
- POST /api/v1/collections/{id}/query

Reads NVIDIA_API_KEY from env (do NOT hardcode keys in source).
"""
import json
import os
import urllib.request
import urllib.error
import time
import sys

# === Configuration ===
SUPABASE_TOKEN = os.environ.get(
    "SUPABASE_TOKEN",
    "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7",
)
PROJECT = os.environ.get("SUPABASE_PROJECT", "tcwdbokruvlizkxcpkzj")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/embeddings"
CHROMA_URL = os.environ.get("CHROMA_URL", "https://eesha-search-8ebb.onrender.com")
COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION", "cellex_products")

if not NVIDIA_API_KEY:
    print("ERROR: NVIDIA_API_KEY env var is not set. Aborting.", file=sys.stderr)
    sys.exit(1)

print(f"Using NVIDIA key: {NVIDIA_API_KEY[:12]}...{NVIDIA_API_KEY[-4:]}")
print(f"Chroma URL: {CHROMA_URL}")
print(f"Collection: {COLLECTION_NAME}")
print()


def http_json(method, url, body=None, timeout=30):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def run_sql(query):
    """Run SQL via Supabase management API."""
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def generate_embedding(text):
    """Generate embedding using NVIDIA nv-embedqa-e5-v5 (1024-dim).

    Uses input_type='passage' because these embeddings are for DOCUMENT STORAGE
    in Chroma (not for search queries). Search queries should use 'query'.
    """
    data = json.dumps(
        {
            "model": "nvidia/nv-embedqa-e5-v5",
            "input": text,
            "input_type": "passage",
            "encoding_format": "float",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        NVIDIA_URL,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.load(r)
            return resp["data"][0]["embedding"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:200]
        print(f"\n  NVIDIA HTTP {e.code}: {body}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"\n  NVIDIA error: {e}", file=sys.stderr)
        return None


def get_or_create_collection(name):
    """
    Chroma v1: list collections, find by name; if missing, create.
    Returns the collection id (string).
    """
    # List existing collections
    try:
        collections = http_json("GET", f"{CHROMA_URL}/api/v1/collections")
        for c in collections:
            if c.get("name") == name:
                print(f"  Collection already exists: id={c['id']}")
                return c["id"]
    except Exception as e:
        print(f"  List collections error: {e}", file=sys.stderr)

    # Create
    try:
        c = http_json("POST", f"{CHROMA_URL}/api/v1/collections", {"name": name})
        print(f"  Collection created: id={c['id']}")
        return c["id"]
    except urllib.error.HTTPError as e:
        if e.code == 409:
            # Race: list again
            collections = http_json("GET", f"{CHROMA_URL}/api/v1/collections")
            for c in collections:
                if c.get("name") == name:
                    return c["id"]
        raise


def add_to_chroma(collection_id, product_id, embedding, metadata):
    """Add a single product embedding to Chroma v1."""
    url = f"{CHROMA_URL}/api/v1/collections/{collection_id}/add"
    body = {
        "ids": [str(product_id)],
        "embeddings": [embedding],
        "metadatas": [metadata],
        "documents": [metadata.get("text", "")],
    }
    try:
        http_json("POST", url, body, timeout=15)
        return True
    except Exception as e:
        print(f"\n  Chroma add error: {e}", file=sys.stderr)
        return False


def count_collection(collection_id):
    """Return number of items in the collection (Chroma v1 count endpoint)."""
    try:
        url = f"{CHROMA_URL}/api/v1/collections/{collection_id}/count"
        with urllib.request.urlopen(url, timeout=10) as r:
            return int(r.read().strip())
    except Exception:
        return -1


def main():
    print("=== Chroma Seeding Script (v1 API) ===")
    print()

    # 1. Collection
    print("1. Ensuring Chroma collection exists...")
    collection_id = get_or_create_collection(COLLECTION_NAME)
    print(f"   collection_id = {collection_id}")
    print(f"   existing items: {count_collection(collection_id)}")
    print()

    # 2. Fetch products
    print("2. Fetching products from Supabase...")
    products = run_sql(
        "SELECT id, name, price, category, description, image_url FROM products ORDER BY id;"
    )
    print(f"   Found {len(products)} products")
    print()

    # 3. Seed
    print("3. Generating embeddings with NVIDIA nv-embedqa-e5-v5 and storing in Chroma...")
    success = 0
    failed = 0
    t0 = time.time()

    for i, product in enumerate(products):
        search_text = " ".join(
            [
                str(product.get("name") or ""),
                str(product.get("category") or ""),
                str(product.get("description") or ""),
            ]
        ).strip()

        label = (product.get("name") or "")[:40]
        print(f"  [{i+1}/{len(products)}] {label}...", end=" ", flush=True)

        emb = generate_embedding(search_text)
        if not emb:
            print("FAILED (no embedding)")
            failed += 1
            continue

        metadata = {
            "product_id": str(product["id"]),
            "name": product.get("name", ""),
            "price": str(product.get("price", 0)),
            "category": product.get("category", ""),
            "image_url": product.get("image_url", ""),
            "text": search_text,
        }

        if add_to_chroma(collection_id, product["id"], emb, metadata):
            print("OK")
            success += 1
        else:
            print("FAILED (Chroma)")
            failed += 1

        time.sleep(0.15)  # avoid rate limit

    elapsed = time.time() - t0
    print()
    print("=== Seeding Complete ===")
    print(f"Success: {success}")
    print(f"Failed:  {failed}")
    print(f"Total:   {len(products)}")
    print(f"Elapsed: {elapsed:.1f}s")
    print(f"Collection items now: {count_collection(collection_id)}")
    print()
    print(f"Chroma URL: {CHROMA_URL}")
    print(f"Collection: {COLLECTION_NAME} ({collection_id})")
    print()
    print("You can now use /api/smart-search for semantic product search!")


if __name__ == "__main__":
    main()
