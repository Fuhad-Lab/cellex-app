#!/usr/bin/env python3
"""Create owncast-streams bucket using the fresh service_role key."""
import json, urllib.request, urllib.error

PROJECT = "tcwdbokruvlizkxcpkzj"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXZsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDEwOTI2NCwiZXhwIjoyMDc1Njg1MjY0fQ.t_TcbBV5k5WWk_bBMoKV-lkAIr9EI-zcREahQqVc39M"

STORAGE_URL = f"https://{PROJECT}.supabase.co/storage/v1/bucket"

# Create the bucket
body = json.dumps({"name": "owncast-streams", "id": "owncast-streams", "public": True}).encode("utf-8")
req = urllib.request.Request(STORAGE_URL, data=body, method="POST",
    headers={"Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json", "apikey": SERVICE_KEY})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"Created: {r.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already" in body.lower() or "exists" in body.lower():
        print("Bucket already exists — OK")
    else:
        print(f"HTTP {e.code}: {body[:300]}")
except Exception as e:
    print(f"ERR: {e}")

# Verify
print("\n=== All buckets ===")
req = urllib.request.Request(STORAGE_URL, method="GET",
    headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        buckets = json.loads(r.read().decode())
        for b in buckets:
            print(f"  - {b.get('id', '?')} (public={b.get('public', '?')})")
except Exception as e:
    print(f"ERR: {e}")

# Print S3 connection info
print("\n=== S3 Connection Info for Owncast Admin Panel ===")
print(f"Endpoint: https://{PROJECT}.supabase.co/storage/v1/s3")
print(f"Serving Endpoint: https://{PROJECT}.supabase.co/storage/v1/object/public/owncast-streams")
print(f"Bucket: owncast-streams")
print(f"Region: us-east-1")
print(f"Force Path Style: Yes")
