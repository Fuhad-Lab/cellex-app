#!/usr/bin/env python3
"""Configure HF Space secrets + variables for eeshaAI/eeshamart-ai via API."""
import json
import sys
import urllib.request
import urllib.error

HF_TOKEN = "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"
REPO_ID = "eeshaAI/eeshamart-ai"  # space

# (key, value, is_secret)
SECRETS = [
    ("SUPABASE_URL",   "https://tcwdbokruvlizkxcpkzj.supabase.co", True),
    ("SUPABASE_KEY",   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXZsaXpreGNwa3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0.p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg", True),
    ("HF_TOKEN",       "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", True),
]

VARIABLES = [
    ("CHAT_MODEL_ID",     "Qwen/Qwen2.5-3B-Instruct"),
    ("VISION_MODEL_ID",   "Salesforce/blip-image-captioning-base"),
    ("PORT",              "7860"),
    ("TORCH_DTYPE",       "float32"),
    ("MAX_NEW_TOKENS",    "512"),
    ("MAX_INPUT_TOKENS",  "3072"),
]


def call(method: str, path: str, body: dict | None = None) -> tuple[int, str]:
    url = f"https://huggingface.co/api/spaces/{REPO_ID}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
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


def main() -> int:
    rc = 0
    print("=== Setting Secrets (sensitive) ===")
    for key, value, _ in SECRETS:
        status, body = call("POST", f"secrets", {"key": key, "value": value})
        ok = status in (200, 201, 204)
        print(f"  [{'OK' if ok else 'FAIL'}] {key:<20s} HTTP {status}  {body[:120] if not ok else ''}")
        if not ok:
            rc = 1

    print("\n=== Setting Variables (non-sensitive) ===")
    for key, value in VARIABLES:
        status, body = call("POST", f"variables", {"key": key, "value": value})
        ok = status in (200, 201, 204)
        print(f"  [{'OK' if ok else 'FAIL'}] {key:<20s} HTTP {status}  {body[:120] if not ok else ''}")
        if not ok:
            rc = 1

    print("\n=== Verifying (list) ===")
    for kind in ("secrets", "variables"):
        status, body = call("GET", kind)
        if status == 200:
            data = json.loads(body)
            keys = [d.get("key") for d in data] if isinstance(data, list) else list(data.keys()) if isinstance(data, dict) else []
            print(f"  {kind}: {keys}")
        else:
            print(f"  {kind}: HTTP {status} {body[:200]}")

    return rc


if __name__ == "__main__":
    sys.exit(main())
