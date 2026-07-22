#!/usr/bin/env python3
"""Configure HF Space secrets for eeshaAI/cellex-web so the Next.js app
can connect to Supabase."""
import json
import urllib.request
import urllib.error
import time

HF_TOKEN = "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"
REPO_ID = "eeshaAI/cellex-web"

SECRETS = [
    ("SUPABASE_URL", "https://tcwdbokruvlizkxcpkzj.supabase.co"),
    ("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0.p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg"),
    ("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDEwOTI2NCwiZXhwIjoyMDc1Njg1MjY0fQ.t_TcbBV5k5WWk_bBMoKV-lkAIr9EI-zcREahQqVc39M"),
    ("GMAIL_EMAIL", "fuhaddesmond7@gmail.com"),
    ("GMAIL_APP_PASSWORD", "mcvkgxktbfqzojlu"),
]

def call(method, path, body=None):
    url = f"https://huggingface.co/api/spaces/{REPO_ID}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)

def main():
    print("=== Setting secrets on eeshaAI/cellex-web ===")
    for key, value in SECRETS:
        status, body = call("POST", "secrets", {"key": key, "value": value})
        ok = status in (200, 201, 204)
        print(f"  [{'OK' if ok else 'FAIL'}] {key:<25s} HTTP {status}  {body[:120] if not ok else ''}")

if __name__ == "__main__":
    main()
