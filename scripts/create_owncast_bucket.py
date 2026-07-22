#!/usr/bin/env python3
"""Create the owncast-streams bucket in Supabase Storage (public).

Owncast needs a public bucket to store video segments that viewers download.
"""
import json, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def api_call(method, path, body=None):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode()
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}: {e.read().decode()[:500]}"
    except Exception as e:
        return f"ERR: {e}"

# Step 1: List existing buckets
print("=== Existing buckets ===")
result = api_call("GET", "/storage/buckets")
print(result[:500])

# Step 2: Create the owncast-streams bucket (public)
print("\n=== Creating owncast-streams bucket ===")
# Use the storage API directly (not management API)
STORAGE_URL = f"https://{PROJECT}.supabase.co/storage/v1/bucket"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXZsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjE1MzM3NCwiZXhwIjoyMDQ3NzEzMzc0fQ.KQpZqVjF2T7mn7sJmNp8m4eW8s1dJ9Yq3vWXq5WqR8M"

create_body = json.dumps({"name": "owncast-streams", "id": "owncast-streams", "public": True}).encode("utf-8")
req = urllib.request.Request(STORAGE_URL, data=create_body, method="POST",
    headers={"Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json", "apikey": SERVICE_KEY})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"Created: {r.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already exists" in body.lower():
        print("Bucket already exists — OK")
    else:
        print(f"HTTP {e.code}: {body[:300]}")
except Exception as e:
    print(f"ERR: {e}")

# Step 3: Verify the bucket exists
print("\n=== Verifying bucket ===")
req = urllib.request.Request(f"{STORAGE_URL}/owncast-streams", method="GET",
    headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(f"Bucket info: {r.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:300]}")
except Exception as e:
    print(f"ERR: {e}")

# Step 4: Get S3 credentials info
print("\n=== S3 Connection Info ===")
print(f"Endpoint: https://{PROJECT}.supabase.co/storage/v1/s3")
print(f"Serving Endpoint: https://{PROJECT}.supabase.co/storage/v1/object/public/owncast-streams")
print(f"Region: us-east-1")
print(f"Bucket: owncast-streams")
print(f"Access Key ID: (find in Supabase Dashboard → Settings → Storage → S3 Connection)")
print(f"Secret Access Key: (find in Supabase Dashboard → Settings → Storage → S3 Connection)")
