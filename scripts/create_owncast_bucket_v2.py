#!/usr/bin/env python3
"""Create the owncast-streams bucket via Supabase Management API."""
import json, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

# Try the management API for storage buckets
url = f"https://api.supabase.com/v1/projects/{PROJECT}/storage/buckets"
body = json.dumps({"name": "owncast-streams", "public": True}).encode("utf-8")
req = urllib.request.Request(url, data=body, method="POST",
    headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"Created: {r.read().decode()[:500]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP {e.code}: {body[:500]}")
    # If it says already exists, that's fine
    if "already" in body.lower() or "exists" in body.lower():
        print("Bucket already exists — OK")
except Exception as e:
    print(f"ERR: {e}")

# Verify
print("\n=== Listing all buckets ===")
req = urllib.request.Request(url, method="GET",
    headers={"Authorization": f"Bearer {TOKEN}", "User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        buckets = json.loads(r.read().decode())
        for b in buckets:
            print(f"  - {b.get('id', '?')} (public={b.get('public', '?')})")
except Exception as e:
    print(f"ERR: {e}")
