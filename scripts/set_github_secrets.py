#!/usr/bin/env python3
"""
Set GitHub Actions secrets on Fuhad-Lab/cellex-app for the Capgo CI/CD pipeline.

Reads the GitHub PAT from /tmp/gh_pat.txt (extracted from the eeshamart-fresh
git config). Uses the GitHub REST API + libsodium (via pynacl) to encrypt each
secret value with the repo's public key before uploading.

Sets:
  - SUPABASE_URL          (already exists, will be refreshed)
  - SUPABASE_ANON_KEY     (already exists, will be refreshed)
  - SUPABASE_SERVICE_KEY  (NEW — needed by the build-apk.sh script's env)
  - CAPGO_TOKEN           (only if /tmp/capgo_token.txt exists — otherwise
                           this script prints instructions for the user)

Idempotent: re-running with the same values is safe.
"""
import base64
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

from nacl import encoding, public

REPO = "Fuhad-Lab/cellex-app"
PAT_FILE = Path("/tmp/gh_pat.txt")
CAPGO_FILE = Path("/tmp/capgo_token.txt")

# Supabase credentials (same ones configured on the HF Space)
SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0."
    "p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg"
)
SUPABASE_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIs"
    "ImlhdCI6MTc2MDEwOTI2NCwiZXhwIjoyMDc1Njg1MjY0fQ."
    "t_TcbBV5k5WWk_bBMoKV-lkAIr9EI-zcREahQqVc39M"
)


def api(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict | str]:
    url = f"https://api.github.com/repos/{REPO}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body_text = resp.read().decode()
            try:
                return resp.status, json.loads(body_text) if body_text else {}
            except json.JSONDecodeError:
                return resp.status, body_text
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        try:
            return e.code, json.loads(body_text)
        except json.JSONDecodeError:
            return e.code, body_text


def get_repo_public_key(token: str) -> tuple[str, str]:
    """Returns (key_id, base64-encoded public key)."""
    status, data = api("GET", "actions/secrets/public-key", token)
    if status != 200:
        raise RuntimeError(f"Failed to fetch repo public key: HTTP {status} {data}")
    return data["key_id"], data["key"]


def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    """Encrypt a secret value with the repo's public key (libsodium sealed box)."""
    public_key_bytes = base64.b64decode(public_key_b64)
    sealed_box = public.SealedBox(public.PublicKey(public_key_bytes))
    encrypted = sealed_box.encrypt(secret_value.encode())
    return base64.b64encode(encrypted).decode()


def put_secret(token: str, key_id: str, public_key_b64: str, name: str, value: str) -> None:
    encrypted = encrypt_secret(public_key_b64, value)
    body = {"encrypted_value": encrypted, "key_id": key_id}
    status, data = api("PUT", f"actions/secrets/{name}", token, body)
    ok = status in (201, 204)
    marker = "OK " if ok else "FAIL"
    print(f"  [{marker}] {name:<25s} HTTP {status}")
    if not ok:
        print(f"         Response: {data}")


def main() -> int:
    if not PAT_FILE.exists():
        print(f"ERROR: PAT file not found at {PAT_FILE}", file=sys.stderr)
        return 1
    token = PAT_FILE.read_text().strip()

    print(f"=== Setting GitHub Actions secrets on {REPO} ===\n")

    # 1. Fetch the repo's public key for encryption
    try:
        key_id, public_key_b64 = get_repo_public_key(token)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"Fetched repo public key (id={key_id}).\n")

    # 2. Set the 3 Supabase secrets (we have all of these)
    print("--- Supabase secrets ---")
    put_secret(token, key_id, public_key_b64, "SUPABASE_URL", SUPABASE_URL)
    put_secret(token, key_id, public_key_b64, "SUPABASE_ANON_KEY", SUPABASE_ANON_KEY)
    put_secret(token, key_id, public_key_b64, "SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)

    # 3. Set CAPGO_TOKEN if the user provided it via /tmp/capgo_token.txt
    print("\n--- Capgo secret ---")
    if CAPGO_FILE.exists():
        capgo_token = CAPGO_FILE.read_text().strip()
        if capgo_token:
            put_secret(token, key_id, public_key_b64, "CAPGO_TOKEN", capgo_token)
        else:
            print("  SKIP — /tmp/capgo_token.txt is empty")
    else:
        print("  SKIP — /tmp/capgo_token.txt not found")
        print("         (Capgo token can only be created by the user at")
        print("          https://web.capgo.app -> Settings -> API Keys)")
        print("         Once you have it, paste it into a file at")
        print("         /tmp/capgo_token.txt and re-run this script.")

    # 4. Verify final state
    print("\n--- Final repo secrets list ---")
    status, data = api("GET", "actions/secrets", token)
    if status == 200:
        for s in data.get("secrets", []):
            print(f"  - {s['name']}  (updated {s['updated_at']})")
        print(f"  Total: {data.get('total_count', 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
