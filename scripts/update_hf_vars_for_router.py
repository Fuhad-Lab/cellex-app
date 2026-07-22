#!/usr/bin/env python3
"""Update HF Space variables for the new HF Router architecture."""
import json
import sys
import urllib.request
import urllib.error

HF_TOKEN = "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"
REPO_ID = "eeshaAI/eeshamart-ai"

# Variables to set (non-sensitive)
VARIABLES = [
    # New / updated
    ("HF_ROUTER_URL",      "https://router.huggingface.co/v1/chat/completions"),
    ("HF_INFERENCE_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
    ("VISION_MODEL_ID",    "Salesforce/blip-image-captioning-base"),
    ("PORT",               "7860"),
    ("MAX_NEW_TOKENS",     "512"),
    ("MAX_INPUT_TOKENS",   "3072"),
    ("AI_TIMEOUT",         "60"),
    # Old vars that are no longer used by the new code (set to placeholder so they don't conflict)
    ("CHAT_MODEL_ID",      ""),     # unused - replaced by HF_INFERENCE_MODEL
    ("TORCH_DTYPE",        ""),     # unused - we use remote model now
]


def call(method: str, path: str, body=None):
    url = f"https://huggingface.co/api/spaces/{REPO_ID}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


def main():
    rc = 0
    print("=== Setting Variables ===")
    for key, value in VARIABLES:
        status, body = call("POST", "variables", {"key": key, "value": value})
        ok = status in (200, 201, 204)
        action = "set" if value else "clear"
        print(f"  [{'OK' if ok else 'FAIL'}] {key:<22s} {action}  HTTP {status}  {body[:100] if not ok else ''}")
        if not ok:
            rc = 1

    print("\n=== Verify all variables ===")
    status, body = call("GET", "variables")
    if status == 200:
        data = json.loads(body)
        for k, v in sorted(data.items()):
            val = v.get("value", "")
            print(f"  {k}: {val!r}")
    else:
        print(f"  HTTP {status}: {body[:200]}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
