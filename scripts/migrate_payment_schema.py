#!/usr/bin/env python3
"""Apply payment schema migration + set Supabase secret."""
import json, urllib.request, urllib.error

SUPABASE_TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def sql(query: str):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method='POST',
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Chrome/126.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode(), "status": e.code}

def set_secret(name: str, value: str):
    """Set a Supabase secret via the management API."""
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/secrets"
    body = json.dumps([{"name": name, "value": value}]).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method='POST',
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Chrome/126.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("=== Step 1: Add matched_bank_name column ===")
result = sql("""
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS matched_bank_name text;
""")
print(json.dumps(result, indent=2))

print("\n=== Step 2: Verify schema ===")
result = sql("""
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='payment_orders'
  AND column_name LIKE 'matched%'
ORDER BY column_name;
""")
print(json.dumps(result, indent=2))

print("\n=== Step 3: Set PAYMENT_VERIFIER_API_KEY secret ===")
status, body = set_secret("PAYMENT_VERIFIER_API_KEY", "cellex-verify-internal-2026")
print(f"  HTTP {status}")
print(f"  Body: {body[:200]}")
