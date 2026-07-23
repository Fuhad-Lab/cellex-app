#!/usr/bin/env python3
"""
Seed product embeddings into Supabase pgvector (replaces Chroma seeding).

This script:
1. Fetches all products from Supabase
2. Generates text embeddings using NVIDIA nv-embedqa-e5-v5 (1024-dim)
3. Upserts them into the product_embeddings table (vector(1024) column)

pgvector is persistent — data survives restarts, unlike Chroma on Render free tier.
Run once after deploying. Can be re-run to update embeddings (uses ON CONFLICT upsert).

Usage:
  NVIDIA_API_KEY=nvapi-... python3 scripts/seed_chroma.py
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

if not NVIDIA_API_KEY:
    print("ERROR: NVIDIA_API_KEY env var is not set. Aborting.", file=sys.stderr)
    sys.exit(1)

print(f"Using NVIDIA key: {NVIDIA_API_KEY[:12]}...{NVIDIA_API_KEY[-4:]}")
print(f"Supabase project: {PROJECT}")
print(f"Target: product_embeddings table (pgvector, 1024-dim)")
print()


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
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def generate_embedding(text):
    """Generate embedding using NVIDIA nv-embedqa-e5-v5 (1024-dim, passage type)."""
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


def upsert_embedding(product_id, embedding, search_text, name, category, price, image_url):
    """Upsert a product embedding into pgvector."""
    # Format embedding as pgvector literal: [0.1,0.2,...]
    embedding_literal = "[" + ",".join(str(float(x)) for x in embedding) + "]"

    # Escape single quotes in text fields
    def esc(s):
        return str(s or "").replace("'", "''")

    query = f"""
        INSERT INTO product_embeddings (product_id, embedding, search_text, name, category, price, image_url, updated_at)
        VALUES ({product_id}::bigint, '{embedding_literal}', '{esc(search_text)}', '{esc(name)}', '{esc(category)}', {price or 0}, '{esc(image_url)}', NOW())
        ON CONFLICT (product_id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            search_text = EXCLUDED.search_text,
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            image_url = EXCLUDED.image_url,
            updated_at = NOW();
    """.strip()
    try:
        run_sql(query)
        return True
    except Exception as e:
        print(f"\n  pgvector upsert error: {e}", file=sys.stderr)
        return False


def main():
    print("=== pgvector Seeding Script ===")
    print()

    # 1. Check pgvector is enabled + table exists
    print("1. Checking pgvector + product_embeddings table...")
    check = run_sql(
        "SELECT COUNT(*) AS count FROM product_embeddings;"
    )
    existing_count = check[0]["count"] if check else 0
    print(f"   Existing embeddings in table: {existing_count}")
    print()

    # 2. Fetch all products
    print("2. Fetching products from Supabase...")
    products = run_sql(
        "SELECT id, name, price, category, description, image_url FROM products ORDER BY id;"
    )
    print(f"   Found {len(products)} products")
    print()

    # 3. Generate embeddings and upsert into pgvector
    print("3. Generating embeddings with NVIDIA nv-embedqa-e5-v5 and upserting into pgvector...")
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

        if not search_text:
            print("SKIP (empty text)")
            failed += 1
            continue

        emb = generate_embedding(search_text)
        if not emb:
            print("FAILED (no embedding)")
            failed += 1
            continue

        if upsert_embedding(
            product["id"],
            emb,
            search_text,
            product.get("name", ""),
            product.get("category", ""),
            product.get("price", 0),
            product.get("image_url", ""),
        ):
            print("OK")
            success += 1
        else:
            print("FAILED (pgvector)")
            failed += 1

        time.sleep(0.15)  # avoid rate limit

    elapsed = time.time() - t0
    print()
    print("=== Seeding Complete ===")
    print(f"Success: {success}")
    print(f"Failed:  {failed}")
    print(f"Total:   {len(products)}")
    print(f"Elapsed: {elapsed:.1f}s")

    # Verify
    final_count = run_sql("SELECT COUNT(*) AS count FROM product_embeddings;")
    print(f"Embeddings in table now: {final_count[0]['count'] if final_count else '?'}")
    print()
    print("Smart search (/api/smart-search) now uses pgvector — persistent, no spin-down wipes.")


if __name__ == "__main__":
    main()
