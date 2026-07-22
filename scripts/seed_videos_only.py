#!/usr/bin/env python3
"""Insert 10-15 videos per seller. Sellers + products already exist."""
import json, urllib.request, random
from datetime import datetime, timedelta, timezone

random.seed(99)

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def sql(query, timeout=60):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method='POST',
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/126.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:500]}"}
    except Exception as e:
        return {"error": str(e)[:500]}

def sql_escape(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

SAMPLE_VIDEOS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
]

CAPTIONS = [
    'Check out this amazing product! 🔥', 'Limited stock — get yours now',
    'Best price in Nigeria 🇳🇬', 'Quality you can trust',
    'Flash sale — 50% off today only', 'Watch before you buy',
    'Customer favorite ⭐', 'New arrival alert 🚨',
    'Don\'t miss this deal', 'Top trending product',
    'See it in action', 'You won\'t believe the price',
    'Honest review', 'Unboxing video', 'Why everyone is buying this',
]

# Get next video ID (just for tracking — id is auto-generated)
result = sql("SELECT COALESCE(MAX(id), 0) as max_id FROM product_videos;")
video_id = result[0]['max_id'] + 1 if result and 'max_id' in result[0] else 1
print(f"Next video ID will auto-generate from: {video_id}")

# Get all sellers with their product IDs (use json_agg for proper JSON array)
print("Fetching seller-product mapping...")
result = sql("""
SELECT s.id as seller_id, s.business_name,
       COALESCE(json_agg(p.id) FILTER (WHERE p.id IS NOT NULL), '[]') as product_ids
FROM sellers s
LEFT JOIN products p ON p.seller_id = s.id
WHERE s.business_name IS NOT NULL
GROUP BY s.id, s.business_name
ORDER BY s.id;
""")

if isinstance(result, dict) and 'error' in result:
    print(f"Error: {result['error']}")
    raise SystemExit(1)

print(f"Found {len(result)} sellers with products")

total_inserted = 0
for s_idx, row in enumerate(result):
    seller_id = row['seller_id']
    seller_name = row['business_name']
    product_ids = row['product_ids']
    # Handle both list and string formats
    if isinstance(product_ids, str):
        if product_ids.startswith('{') and product_ids.endswith('}'):
            product_ids = [int(x) for x in product_ids[1:-1].split(',') if x.strip()]
        elif product_ids.startswith('[') and product_ids.endswith(']'):
            product_ids = json.loads(product_ids)
        else:
            product_ids = []
    if not product_ids:
        continue

    num_videos = random.randint(10, 15)
    values_parts = []
    now = datetime.now(timezone.utc)
    for i in range(num_videos):
        pid = random.choice(product_ids)
        url = random.choice(SAMPLE_VIDEOS)
        cap = random.choice(CAPTIONS)
        views = random.randint(100, 50000)
        likes = random.randint(10, views // 5)
        created = (now - timedelta(days=random.randint(1, 60))).isoformat()
        values_parts.append(
            f"({pid}, {sql_escape(seller_id)}, {sql_escape(url)}, "
            f"NULL, {sql_escape(cap)}, {views}, {likes}, 'active', {sql_escape(created)})"
        )
        video_id += 1

    q = f"""
        INSERT INTO product_videos (product_id, seller_id, video_url, thumbnail_url,
                                     caption, views_count, likes_count, status, created_at)
        VALUES {', '.join(values_parts)};
    """
    result2 = sql(q, timeout=60)
    if isinstance(result2, dict) and 'error' in result2:
        print(f"  ✗ Seller {s_idx+1} ({seller_name}) failed: {result2['error'][:300]}")
    else:
        total_inserted += num_videos
        print(f"  ✓ Seller {s_idx+1} ({seller_name}): {num_videos} videos (total: {total_inserted})")

print(f"\n✅ Inserted {total_inserted} videos total")

# Final counts
print("\n=== Final counts ===")
result = sql("""
SELECT 'sellers' as tbl, COUNT(*) FROM sellers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_videos', COUNT(*) FROM product_videos;
""")
print(json.dumps(result, indent=2))
