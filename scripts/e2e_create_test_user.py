#!/usr/bin/env python3
"""Create a fresh test user and session for end-to-end flow testing."""
import json, urllib.request, urllib.error

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDEwOTI2NCwiZXhwIjoyMDc1Njg1MjY0fQ.t_TcbBV5k5WWk_bBMoKV-lkAIr9EI-zcREahQqVc39M"
SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj.supabase.co"
SUPABASE_TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

import time
TEST_EMAIL = f"e2e-test-{int(time.time())}@cellex.test"
TEST_PASSWORD = "CellexTest2026!"

print(f"=== Creating test user: {TEST_EMAIL} ===")

# Create user via admin API
body = json.dumps({
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "email_confirm": True,
}).encode("utf-8")
req = urllib.request.Request(
    f"{SUPABASE_URL}/auth/v1/admin/users",
    data=body, method='POST',
    headers={
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        user_data = json.load(r)
    USER_ID = user_data['id']
    print(f"✓ User created: {USER_ID}")
except urllib.error.HTTPError as e:
    print(f"✗ Failed: {e.read().decode()}")
    raise SystemExit(1)

# Now login via the auth edge function to get a session
print(f"\n=== Logging in to get session ===")
body = json.dumps({"email": TEST_EMAIL, "password": TEST_PASSWORD}).encode("utf-8")
req = urllib.request.Request(
    f"{SUPABASE_URL}/functions/v1/auth",
    data=body, method='POST',
    headers={
        "Authorization": f"Bearer anonymous",
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0.p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        login_data = json.load(r)
    if login_data.get('success'):
        SESSION_ID = login_data['session_id']
        print(f"✓ Login successful")
        print(f"  User ID: {login_data.get('user', {}).get('id')}")
        print(f"  Email: {login_data.get('user', {}).get('email')}")
        print(f"  Session: {SESSION_ID[:30]}...")
    else:
        print(f"✗ Login failed: {login_data}")
        raise SystemExit(1)
except urllib.error.HTTPError as e:
    print(f"✗ Login HTTP error: {e.read().decode()}")
    raise SystemExit(1)

# Save credentials for next steps
with open('/tmp/cellex_e2e_creds.json', 'w') as f:
    json.dump({
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "user_id": USER_ID,
        "session_id": SESSION_ID,
    }, f, indent=2)

print(f"\n✓ Credentials saved to /tmp/cellex_e2e_creds.json")
print(f"\nUse these for the next steps:")
print(f"  SESSION_ID={SESSION_ID}")
