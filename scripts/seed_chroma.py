#!/usr/bin/env python3
"""
Seed Chroma Vector DB with product embeddings from NVIDIA NIM.

This script:
1. Fetches all products from Supabase
2. Generates text embeddings using NVIDIA embed-qa-4
3. Stores them in Chroma DB for semantic search

Run once after deploying Chroma DB. Can be re-run to update embeddings.
"""
import json
import urllib.request
import urllib.error
import time
import sys

# Configuration
SUPABASE_TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"
NVIDIA_API_KEY = "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"
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/embeddings"
CHROMA_URL = "https://eesha-search-8ebb.onrender.com"
COLLECTION_NAME = "cellex_products"

def run_sql(query):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
        headers={"Authorization": f"Bearer {SUPABASE_TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def generate_embedding(text):
    """Generate embedding using NVIDIA embed-qa-4"""
    data = json.dumps({
        "model": "nvidia/embed-qa-4",
        "input": text,
        "input_type": "query",
        "encoding_format": "float"
    }).encode("utf-8")
    req = urllib.request.Request(NVIDIA_URL, data=data, method="POST",
        headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            resp = json.load(r)
            return resp["data"][0]["embedding"]
    except Exception as e:
        print(f"  NVIDIA error: {e}")
        return None

def create_chroma_collection():
    """Create the cellex_products collection in Chroma"""
    url = f"{CHROMA_URL}/api/v2/collections"
    data = json.dumps({"name": COLLECTION_NAME}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            print(f"  Collection created: {json.load(r)}")
    except urllib.error.HTTPError as e:
        if e.code == 409:
            print("  Collection already exists")
        else:
            print(f"  Collection error: {e}")

def add_to_chroma(product_id, embedding, metadata):
    """Add a product embedding to Chroma"""
    url = f"{CHROMA_URL}/api/v2/collections/{COLLECTION_NAME}/add"
    data = json.dumps({
        "ids": [str(product_id)],
        "embeddings": [embedding],
        "metadatas": [metadata],
        "documents": [metadata.get("text", "")]
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True
    except Exception as e:
        print(f"  Chroma add error: {e}")
        return False

def main():
    print("=== Chroma Seeding Script ===")
    print()
    
    # Step 1: Create collection
    print("1. Creating Chroma collection...")
    create_chroma_collection()
    
    # Step 2: Fetch all products
    print("2. Fetching products from Supabase...")
    products = run_sql("SELECT id, name, price, category, description, image_url FROM products ORDER BY id;")
    print(f"   Found {len(products)} products")
    
    # Step 3: Generate embeddings and store in Chroma
    print("3. Generating embeddings with NVIDIA embed-qa-4...")
    success = 0
    failed = 0
    
    for i, product in enumerate(products):
        # Create search text from product fields
        search_text = f"{product['name']} {product.get('category', '')} {product.get('description', '')}"
        
        print(f"  [{i+1}/{len(products)}] {product['name'][:40]}...", end=" ")
        
        # Generate embedding
        embedding = generate_embedding(search_text)
        if not embedding:
            print("FAILED (no embedding)")
            failed += 1
            continue
        
        # Store in Chroma
        metadata = {
            "product_id": str(product["id"]),
            "name": product["name"],
            "price": str(product.get("price", 0)),
            "category": product.get("category", ""),
            "image_url": product.get("image_url", ""),
            "text": search_text,
        }
        
        if add_to_chroma(product["id"], embedding, metadata):
            print("OK")
            success += 1
        else:
            print("FAILED (Chroma)")
            failed += 1
        
        # Small delay to avoid rate limiting
        time.sleep(0.2)
    
    print()
    print(f"=== Seeding Complete ===")
    print(f"Success: {success}")
    print(f"Failed: {failed}")
    print(f"Total: {len(products)}")
    print()
    print(f"Chroma DB: {CHROMA_URL}")
    print(f"Collection: {COLLECTION_NAME}")
    print()
    print("You can now use /api/smart-search for semantic product search!")

if __name__ == "__main__":
    main()
