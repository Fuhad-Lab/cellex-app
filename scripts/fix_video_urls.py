#!/usr/bin/env python3
"""Replace all video URLs in product_videos with working public MP4 URLs."""
import json, urllib.request, random

random.seed(42)

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def sql(query, timeout=120):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method='POST',
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/126.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:300]}"}
    except Exception as e:
        return {"error": str(e)[:300]}

# Working public MP4 URLs (verified)
WORKING_VIDEOS = [
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
    'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://www.w3schools.com/html/movie.mp4',
    'https://vjs.zencdn.net/v/oceans.mp4',
    'https://media.w3.org/2010/05/sintel/trailer.mp4',
]

print("=== Updating all video URLs to working public MP4s ===")

# Update in batches of 100 by ID range
result = sql("SELECT MIN(id), MAX(id), COUNT(*) FROM product_videos;")
if isinstance(result, dict) and 'error' in result:
    print(f"Error: {result['error']}")
    raise SystemExit(1)

min_id = result[0]['min']
max_id = result[0]['max']
total = result[0]['count']
print(f"Video IDs: {min_id} to {max_id} ({total} total)")

# Update each video with a random working URL
BATCH = 50
updated = 0
for start in range(min_id, max_id + 1, BATCH):
    end = min(start + BATCH - 1, max_id)
    # Pick one URL for the whole batch (simpler + faster)
    url = random.choice(WORKING_VIDEOS)
    q = f"""
        UPDATE product_videos
        SET video_url = '{url}'
        WHERE id BETWEEN {start} AND {end};
    """
    result = sql(q, timeout=60)
    if isinstance(result, dict) and 'error' in result:
        print(f"  ✗ Batch {start}-{end} failed: {result['error'][:200]}")
    else:
        updated += (end - start + 1)
        print(f"  ✓ Batch {start}-{end}: updated (total: {updated})")

print(f"\n✅ Updated {updated} videos")

# Verify
print("\n=== Sample updated videos ===")
result = sql("SELECT id, video_url FROM product_videos ORDER BY id LIMIT 5;")
print(json.dumps(result, indent=2))
