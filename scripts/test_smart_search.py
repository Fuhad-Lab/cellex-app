#!/usr/bin/env python3
"""End-to-end smoke test of the smart-search flow:
1. Generate a query embedding from NVIDIA (nv-embedqa-e5-v5, input_type=query)
2. Query Chroma v1 collection for nearest neighbors
3. Print ranked results
"""
import json
import os
import urllib.request

KEY = os.environ.get("NVIDIA_API_KEY", "")
CHROMA_URL = "https://eesha-search-8ebb.onrender.com"
COLLECTION_NAME = "cellex_products"

QUERY = "noise cancelling bluetooth headphones for calls"

# 1. List collections to find our collection id
print(f"Query: {QUERY!r}")
print()
print("1. Resolving Chroma collection id...")
with urllib.request.urlopen(f"{CHROMA_URL}/api/v1/collections") as r:
    collections = json.load(r)
collection = next(c for c in collections if c["name"] == COLLECTION_NAME)
cid = collection["id"]
print(f"   collection_id = {cid}")
print()

# 2. Generate query embedding via NVIDIA
print("2. Generating query embedding via NVIDIA nv-embedqa-e5-v5...")
body = json.dumps(
    {
        "model": "nvidia/nv-embedqa-e5-v5",
        "input": QUERY,
        "input_type": "query",
        "encoding_format": "float",
    }
).encode("utf-8")
req = urllib.request.Request(
    "https://integrate.api.nvidia.com/v1/embeddings",
    data=body,
    method="POST",
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=15) as r:
    resp = json.load(r)
embedding = resp["data"][0]["embedding"]
print(f"   dim = {len(embedding)}")
print()

# 3. Query Chroma
print("3. Querying Chroma for top 5 nearest products...")
body = json.dumps(
    {
        "query_embeddings": [embedding],
        "n_results": 5,
        "include": ["distances", "documents", "metadatas"],
    }
).encode("utf-8")
req = urllib.request.Request(
    f"{CHROMA_URL}/api/v1/collections/{cid}/query",
    data=body,
    method="POST",
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=10) as r:
    result = json.load(r)

ids = result["ids"][0]
dists = result["distances"][0]
metas = result["metadatas"][0]

print(f"   {'Rank':<5} {'ID':<5} {'Dist':<8} {'Name':<35} {'Category'}")
print(f"   {'----':<5} {'--':<5} {'----':<8} {'----':<35} {'--------'}")
for i, (pid, d, m) in enumerate(zip(ids, dists, metas), 1):
    name = (m.get("name") or "")[:34]
    cat = m.get("category") or ""
    print(f"   {i:<5} {pid:<5} {d:<8.4f} {name:<35} {cat}")

print()
print("Smart search flow works end-to-end.")
