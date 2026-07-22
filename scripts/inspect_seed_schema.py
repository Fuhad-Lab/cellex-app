#!/usr/bin/env python3
"""Inspect current sellers/products/product_videos schema + data counts."""
import json, urllib.request

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def sql(query):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method='POST',
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/126.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

print("=== Sellers schema ===")
print(json.dumps(sql("""SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='sellers'
ORDER BY ordinal_position;"""), indent=2))

print("\n=== Products schema ===")
print(json.dumps(sql("""SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='products'
ORDER BY ordinal_position;"""), indent=2))

print("\n=== Product videos schema ===")
print(json.dumps(sql("""SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='product_videos'
ORDER BY ordinal_position;"""), indent=2))

print("\n=== Current counts ===")
print(json.dumps(sql("""
SELECT 'sellers' as tbl, COUNT(*) FROM sellers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_videos', COUNT(*) FROM product_videos;
"""), indent=2))

print("\n=== Sample seller ===")
print(json.dumps(sql("SELECT id, business_name, business_category, seller_type FROM sellers LIMIT 3;"), indent=2))

print("\n=== Sample product ===")
print(json.dumps(sql("SELECT id, name, price, category, seller_id, image_url FROM products LIMIT 3;"), indent=2))
