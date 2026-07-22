#!/usr/bin/env python3
"""
Remediate exposed secrets in GitHub repos.

For each exposure:
  1. Fetch the current file content + SHA from GitHub
  2. Replace hardcoded secret values with os.environ.get() / process.env references
     (NO fallback to the actual secret value)
  3. Commit + push the fix

Targets (in priority order):
  - eesha-co/EeshaMart (PUBLIC) — multiple secrets in code
  - Fuhad-Lab/cellex-payment-verifier (PRIVATE) — fallback defaults in code
  - Fuhad-Lab/kimi-k26-ude (PUBLIC) — .env file with NVIDIA key

NOTE: This does NOT scrub git history. The secrets were committed in the past
and remain in history. The user should:
  - Rotate the exposed secrets (generate new ones, revoke old ones)
  - Optionally use git filter-repo or BFG to scrub history
"""
import base64
import json
import re
import sys
import urllib.request
import urllib.error

GH_PAT = open("/tmp/gh_pat.txt").read().strip()

def api(method, path, body=None, owner_repo=None):
    base = f"https://api.github.com/repos/{owner_repo}/" if owner_repo else "https://api.github.com/"
    url = base + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {GH_PAT}",
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


def get_file(owner_repo, path, branch="main"):
    status, data = api("GET", f"contents/{path}?ref={branch}", None, owner_repo)
    if status != 200:
        return None, None, None
    content = base64.b64decode(data["content"]).decode("utf-8")
    return content, data["sha"], data.get("encoding", "base64")


def put_file(owner_repo, path, content, sha, branch, message):
    b64 = base64.b64encode(content.encode()).decode()
    body = {"message": message, "content": b64, "sha": sha, "branch": branch}
    status, data = api("PUT", f"contents/{path}", body, owner_repo)
    return status, data


def remediate_file(owner_repo, path, replacements, message, branch="main"):
    """Apply a list of (regex, replacement) pairs to a file and commit."""
    content, sha, _ = get_file(owner_repo, path, branch)
    if content is None:
        print(f"  SKIP — file not found: {owner_repo}/{path}")
        return False
    new_content = content
    for pattern, replacement in replacements:
        new_content = re.sub(pattern, replacement, new_content)
    if new_content == content:
        print(f"  SKIP — no changes needed: {owner_repo}/{path}")
        return False
    status, data = put_file(owner_repo, path, new_content, sha, branch, message)
    ok = status in (200, 201)
    marker = "OK " if ok else "FAIL"
    print(f"  [{marker}] {owner_repo}/{path}  HTTP {status}")
    if not ok:
        print(f"         {str(data)[:200]}")
    return ok


def main():
    print("=" * 60)
    print("  REMEDIATING EXPOSED SECRETS")
    print("=" * 60)

    # ---- 1. eesha-co/EeshaMart (PUBLIC) ------------------------------------
    print("\n[1/3] eesha-co/EeshaMart (PUBLIC) — critical exposures")

    # whatsapp-gateway/startup.sh — Supabase service_role + anon key hardcoded
    remediate_file(
        "eesha-co/EeshaMart",
        "whatsapp-gateway/startup.sh",
        [
            # Replace hardcoded SUPABASE_URL with env var
            (r'SUPABASE_URL="https://tcwdbokruvlizkxcpkzj\.supabase\.co"',
             'SUPABASE_URL="${SUPABASE_URL:-}"'),
            # Replace hardcoded anon key
            (r'SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+"',
             'SUPABASE_KEY="${SUPABASE_KEY:-}"'),
            # Replace hardcoded service_role key
            (r'SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+"',
             'SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"'),
        ],
        "security: remove hardcoded Supabase keys from startup.sh — use env vars",
    )

    # telegram-bot/app.py — Telegram bot token + Supabase anon key as fallback defaults
    remediate_file(
        "eesha-co/EeshaMart",
        "telegram-bot/app.py",
        [
            (r'TELEGRAM_BOT_TOKEN = os\.environ\.get\("TELEGRAM_BOT_TOKEN", "8142562507:AAG-_UExIh18e6mz-0URKmv67-CQOk_cuA4"\)',
             'TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")'),
            (r'SUPABASE_KEY = os\.environ\.get\("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+"\)',
             'SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")'),
        ],
        "security: remove hardcoded Telegram bot token + Supabase key fallbacks",
    )

    # src/app/api/ai/chat/route.ts — hardcoded Supabase URL + anon key
    remediate_file(
        "eesha-co/EeshaMart",
        "src/app/api/ai/chat/route.ts",
        [
            (r'const SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj\.supabase\.co";',
             'const SUPABASE_URL = process.env.SUPABASE_URL || "";'),
            (r'const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+";',
             'const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";'),
        ],
        "security: remove hardcoded Supabase credentials — use process.env",
    )

    # admin/index.html — hardcoded Supabase URL + anon key in browser
    remediate_file(
        "eesha-co/EeshaMart",
        "admin/index.html",
        [
            (r"const SUPABASE_URL = 'https://tcwdbokruvlizkxcpkzj\.supabase\.co';",
             "const SUPABASE_URL = window.location.origin.includes('hf.space') ? 'https://eeshaai-cellex-web.hf.space' : 'http://localhost:3000';"),
            (r"const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+';",
             "const SUPABASE_ANON_KEY = ''; // fetch from /api/auth/session instead"),
        ],
        "security: remove browser-exposed Supabase anon key from admin panel",
    )

    # admin/live-sessions.html — same pattern
    remediate_file(
        "eesha-co/EeshaMart",
        "admin/live-sessions.html",
        [
            (r"const SUPABASE_URL = 'https://tcwdbokruvlizkxcpkzj\.supabase\.co';",
             "const SUPABASE_URL = window.location.origin.includes('hf.space') ? 'https://eeshaai-cellex-web.hf.space' : 'http://localhost:3000';"),
            (r"const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\.-]+';",
             "const SUPABASE_ANON_KEY = ''; // fetch from /api/auth/session instead"),
        ],
        "security: remove browser-exposed Supabase anon key from live-sessions admin",
    )

    # ---- 2. Fuhad-Lab/cellex-payment-verifier (PRIVATE) --------------------
    print("\n[2/3] Fuhad-Lab/cellex-payment-verifier — fallback defaults")
    remediate_file(
        "Fuhad-Lab/cellex-payment-verifier",
        "verifier_app.py",
        [
            (r'GMAIL_APP_PASSWORD = os\.environ\.get\("GMAIL_APP_PASSWORD", "mcvkgxktbfqzojlu"\)',
             'GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")'),
            (r'SUPABASE_TOKEN = os\.environ\.get\("SUPABASE_TOKEN", "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"\)',
             'SUPABASE_TOKEN = os.environ.get("SUPABASE_TOKEN", "")'),
            (r'HF_TOKEN = os\.environ\.get\("HF_TOKEN", "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"\)',
             'HF_TOKEN = os.environ.get("HF_TOKEN", "")'),
        ],
        "security: remove hardcoded secret fallbacks — require env vars",
    )

    # ---- 3. Fuhad-Lab/kimi-k26-ude (PUBLIC) --------------------------------
    print("\n[3/3] Fuhad-Lab/kimi-k26-ude — .env with NVIDIA key")
    # .env files shouldn't be in git at all. Replace with .env.example
    remediate_file(
        "Fuhad-Lab/kimi-k26-ude",
        ".env",
        [
            (r'NVIDIA_API_KEY=nvapi-[A-Za-z0-9_-]+',
             'NVIDIA_API_KEY=your_nvidia_api_key_here'),
        ],
        "security: redact NVIDIA API key from .env — use placeholder",
    )

    print("\n" + "=" * 60)
    print("  REMEDIATION COMPLETE")
    print("=" * 60)
    print("\nNOTE: Git history still contains the old secrets. You should:")
    print("  1. Rotate ALL exposed secrets (generate new ones, revoke old):")
    print("     - Supabase: Dashboard → Project Settings → API → Reset keys")
    print("     - Hugging Face: Settings → Access Tokens → Create new, delete old")
    print("     - Telegram: @BotFather → /revoke")
    print("     - NVIDIA: https://build.nvidia.com → Settings → API Keys")
    print("     - Gmail: Google Account → Security → App passwords → Revoke")
    print("     - Capgo: https://console.capgo.app → API Keys → Rotate")
    print("  2. Optionally scrub git history with BFG or git filter-repo")
    print("     (only needed if you care about the historical commits)")


if __name__ == "__main__":
    main()
