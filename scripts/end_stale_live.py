#!/usr/bin/env python3
"""End stale live sessions in shop_live_sessions table (older than 2 hours)."""
import json, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
query = "UPDATE shop_live_sessions SET status = 'ended', ended_at = NOW() WHERE status = 'live' AND started_at < NOW() - INTERVAL '2 hours';"
body = json.dumps({"query": query}).encode("utf-8")
req = urllib.request.Request(url, data=body, method="POST",
    headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(r.read().decode()[:300])
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:300]}")
