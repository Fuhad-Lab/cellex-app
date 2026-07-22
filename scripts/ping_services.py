#!/usr/bin/env python3
"""
Ping all 3 Render services to keep them warm.

Render free tier sleeps after 15 min of inactivity. This script pings:
  - eesha-learn (main app)   → https://eesha-learn.onrender.com/
  - Chroma (vector DB)       → https://eesha-search-8ebb.onrender.com/api/v1/heartbeat
  - Gorse (recommender)      → https://learn-eesha.onrender.com/api/health

Run this every 10 minutes via:
  - Render Cron Job (free)
  - UptimeRobot (free, external)
  - cron-job.org (free, external)
  - GitHub Actions (scheduled workflow)

Usage:
  python3 scripts/ping_services.py
"""
import json
import time
import urllib.request
import urllib.error
import sys

SERVICES = [
    {
        "name": "eesha-learn",
        "url": "https://eesha-learn.onrender.com/",
        "expected": 200,
    },
    {
        "name": "Chroma",
        "url": "https://eesha-search-8ebb.onrender.com/api/v1/heartbeat",
        "expected": 200,
    },
    {
        "name": "Gorse",
        "url": "https://learn-eesha.onrender.com/api/health",
        "expected": 200,
    },
]

def ping(service):
    """Ping a single service. Returns (ok, latency_seconds, error_msg)."""
    t0 = time.time()
    try:
        req = urllib.request.Request(service["url"], method="GET",
            headers={"User-Agent": "cellex-keepalive/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            elapsed = time.time() - t0
            ok = r.status == service["expected"]
            return ok, elapsed, None
    except urllib.error.HTTPError as e:
        elapsed = time.time() - t0
        return False, elapsed, f"HTTP {e.code}"
    except Exception as e:
        elapsed = time.time() - t0
        return False, elapsed, str(e)[:100]

def main():
    print(f"Pinging {len(SERVICES)} services at {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print()
    all_ok = True
    for svc in SERVICES:
        ok, latency, err = ping(svc)
        status = "OK" if ok else "FAIL"
        detail = f"{latency:.2f}s" if ok else f"{err} ({latency:.2f}s)"
        # Flag slow responses (likely spin-up)
        slow = latency > 5.0 if ok else False
        slow_flag = " [SLOW - was sleeping?]" if slow else ""
        print(f"  [{status:4s}] {svc['name']:15s}  {detail}{slow_flag}")
        if not ok:
            all_ok = False
    print()
    if all_ok:
        print("All services are warm.")
        sys.exit(0)
    else:
        print("Some services failed — check above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
