#!/usr/bin/env python3
"""Check payment_orders table schema and current state."""
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

print("=== payment_orders schema ===")
print(json.dumps(sql("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payment_orders'
ORDER BY ordinal_position;
"""), indent=2))

print("\n=== Recent orders (last 5) ===")
print(json.dumps(sql("""
SELECT order_id, status, expected_amount, buyer_name, buyer_bank_name, buyer_email, buyer_phone,
       matched_sender_name, matched_amount, matched_email_id,
       created_at, verification_started_at, matched_at, expires_at
FROM payment_orders
ORDER BY created_at DESC
LIMIT 5;
"""), indent=2))

print("\n=== Status distribution ===")
print(json.dumps(sql("""
SELECT status, COUNT(*) as count
FROM payment_orders
GROUP BY status
ORDER BY count DESC;
"""), indent=2))
