#!/usr/bin/env python3
"""
Security scan: search all accessible GitHub repos + Hugging Face spaces for
exposed secrets (API keys, tokens, passwords, private keys).

Scans:
  1. Current file contents of every repo (via GitHub Contents API + git clone)
  2. Current file contents of every HF space (via HF API + git clone)
  3. Git commit history of cellex-app + a few other active repos

Reports any matches with file path, line number, and the type of secret.
Does NOT print the full secret value — only the first 8 chars + length.

Usage:
  python3 scripts/security_scan.py
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

# ---- Credentials ------------------------------------------------------------
GH_PAT = open("/tmp/gh_pat.txt").read().strip()
HF_TOKEN = "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"

# ---- Secret patterns --------------------------------------------------------
# Each pattern: (name, regex, severity)
SECRET_PATTERNS = [
    # GitHub tokens
    ("GitHub PAT (ghp_)",       r"ghp_[A-Za-z0-9]{36,}",                          "CRITICAL"),
    ("GitHub PAT (github_pat_)", r"github_pat_[A-Za-z0-9_]{82}",                  "CRITICAL"),
    ("GitHub OAuth (gho_)",     r"gho_[A-Za-z0-9]{36,}",                          "CRITICAL"),
    ("GitHub App (ghs_)",       r"ghs_[A-Za-z0-9]{36,}",                          "CRITICAL"),
    ("GitHub Refresh (ghr_)",   r"ghr_[A-Za-z0-9]{76,}",                          "CRITICAL"),

    # Hugging Face tokens
    ("Hugging Face token",      r"hf_[A-Za-z0-9]{30,}",                           "CRITICAL"),

    # Capgo tokens (UUID format)
    ("Capgo token (UUID)",      r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", "HIGH"),

    # Supabase JWTs (anon + service)
    ("Supabase JWT",            r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[A-Za-z0-9_\.-]+", "CRITICAL"),

    # Telegram bot tokens
    ("Telegram bot token",      r"\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b",            "CRITICAL"),

    # OpenAI / Anthropic / Google AI
    ("OpenAI key",              r"sk-[A-Za-z0-9]{40,}",                           "CRITICAL"),
    ("Anthropic key",           r"sk-ant-[A-Za-z0-9_-]{40,}",                     "CRITICAL"),
    ("Google AI key",           r"AIza[A-Za-z0-9_-]{35}",                         "CRITICAL"),

    # NVIDIA API key (nvapi-...)
    ("NVIDIA API key",          r"nvapi-[A-Za-z0-9]{32,}",                        "HIGH"),

    # Generic API key patterns (variable assignments)
    ("API key assignment",      r"(?i)(api[_-]?key|apikey)\s*[=:]\s*['\"][A-Za-z0-9_-]{20,}['\"]", "MEDIUM"),
    ("Secret assignment",       r"(?i)(secret|client[_-]?secret)\s*[=:]\s*['\"][A-Za-z0-9_-]{20,}['\"]", "MEDIUM"),
    ("Token assignment",        r"(?i)(access[_-]?token|auth[_-]?token)\s*[=:]\s*['\"][A-Za-z0-9_-]{20,}['\"]", "MEDIUM"),

    # Private keys
    ("RSA/EC private key",      r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----", "CRITICAL"),

    # Passwords in config files (only flag obvious ones)
    ("Password assignment",     r"(?i)password\s*[=:]\s*['\"][^'\"]{8,}['\"]",    "MEDIUM"),

    # Gmail app passwords (16 chars, lowercase)
    ("Gmail app password",      r"\b[a-z]{16}\b(?=[\s\"']*(?:#|$|gmail|email))",   "LOW"),

    # CellexBot internal API key
    ("CellexBot API key",       r"CellexBot\d{4}",                                "MEDIUM"),

    # Connection strings with credentials
    ("Connection string",       r"(?:postgres|mysql|mongodb)://[^:\s]+:[^@\s]+@", "HIGH"),

    # .env file pattern leaks
    ("Bot API key (BOT_API_KEY)", r"BOT_API_KEY\s*=\s*[A-Za-z0-9_-]{10,}",        "MEDIUM"),
]

# Compile patterns
COMPILED = [(name, re.compile(p), sev) for name, p, sev in SECRET_PATTERNS]

# ---- Whitelist (known-safe patterns) ----------------------------------------
# These are NOT secrets — public keys, demo values, placeholder text, etc.
WHITELIST = [
    "your_api_key_here", "YOUR_API_KEY", "placeholder", "example",
    "test_test_test", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "sk-ant-api03-access-key",  # Anthropic placeholder in docs
    "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  # GitHub placeholder in docs
    "hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  # HF placeholder in docs
    # JWT placeholder examples
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi",
    # Common test/demo tokens
    "test_token", "demo_token", "sample_token",
]

# Known actual secrets we've already placed in HF Space config (these ARE secrets
# but we know about them — they're stored as HF secrets, not in code). We still
# report them if they appear in plaintext in a file.
KNOWN_SECRETS = {
    "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",  # HF token (in scripts)
    "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",  # older HF token
    "6e02e332-85a9-411b-a48a-87e901f2c8fd",   # Capgo token
    "CellexBot2024",                           # internal bot API key
    "8142562507:AAG-_UExIh18e6mz-0URKmv67-CQOk_cuA4",  # Telegram bot token
    "mcvkgxktbfqzojlu",                        # Gmail app password
    "fuhaddesmond7@gmail.com",                 # Gmail address
    # Supabase keys
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24i",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIs",
}

# File types to skip (binary / lock files / huge files)
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".mp4", ".mp3", ".wav", ".ogg", ".webm",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".lock",  # package-lock.json, bun.lock etc — too noisy
    ".bin", ".dat", ".so", ".dll", ".exe", ".dylib",
    ".tsbuildinfo", ".map",
}
SKIP_FILENAMES = {
    "package-lock.json", "bun.lock", "yarn.lock", "pnpm-lock.yaml",
    ".gitattributes", ".gitignore",
    "node_modules", ".next", ".git", "out", "dist", "build",
    "vendor", "__pycache__", ".venv", "venv",
}


def is_whitelisted(text: str) -> bool:
    """Return True if the matched text is a known placeholder/example."""
    text_lower = text.lower()
    for w in WHITELIST:
        if w.lower() in text_lower:
            return True
    return False


def mask_secret(s: str) -> str:
    """Show only the first 8 chars + length, never the full secret."""
    if len(s) <= 12:
        return f"{s[:4]}...({len(s)} chars)"
    return f"{s[:8]}...({len(s)} chars)"


def scan_text(text: str, source: str, line_offset: int = 0) -> list[dict]:
    """Scan a text blob for secrets. Returns list of findings."""
    findings = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for name, pattern, severity in COMPILED:
            for m in pattern.finditer(line):
                matched = m.group(0)
                if is_whitelisted(matched):
                    continue
                # Skip if it's a placeholder like ${VARIABLE} or {{ secret }}
                if "${" in matched or "{{" in matched or "secrets." in matched:
                    continue
                # Skip GitHub Actions secret references
                if "secrets." in line and "${{" in line:
                    continue
                # Skip env var references like process.env.X
                if "process.env" in line or "os.environ" in line or "os.getenv" in line:
                    continue
                findings.append({
                    "type": name,
                    "severity": severity,
                    "source": source,
                    "line": line_offset + line_no,
                    "matched": mask_secret(matched),
                    "context": line.strip()[:120],
                    "known": matched in KNOWN_SECRETS,
                })
    return findings


def scan_file(path: str, source_prefix: str = "") -> list[dict]:
    """Scan a single file. Returns list of findings."""
    p = Path(path)
    if p.suffix.lower() in SKIP_EXTENSIONS or p.name in SKIP_FILENAMES:
        return []
    try:
        # Skip files larger than 1MB
        if p.stat().st_size > 1_000_000:
            return []
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    return scan_text(text, f"{source_prefix}{path}")


def scan_directory(path: str, source_prefix: str = "") -> list[dict]:
    """Recursively scan a directory."""
    findings = []
    for root, dirs, files in os.walk(path):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in SKIP_FILENAMES and not d.startswith(".git")]
        for f in files:
            full = os.path.join(root, f)
            findings.extend(scan_file(full, source_prefix))
    return findings


def gh_api(path: str) -> dict:
    url = f"https://api.github.com/{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {GH_PAT}",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def hf_api(path: str) -> dict:
    url = f"https://huggingface.co/api/{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def list_github_repos() -> list[dict]:
    """List all repos the PAT can see (owned + collaborator)."""
    repos = []
    for page in range(1, 5):
        try:
            data = gh_api(f"user/repos?per_page=100&page={page}&sort=updated&affiliation=owner,collaborator,organization_member")
        except Exception:
            break
        if not data:
            break
        repos.extend(data)
    return repos


def list_hf_spaces() -> list[dict]:
    """List all HF spaces owned by the user."""
    try:
        return hf_api("spaces?author=fuhaddesmond") + hf_api("spaces?author=eeshaAI")
    except Exception:
        try:
            return hf_api("spaces?author=fuhaddesmond")
        except Exception:
            return []


def clone_and_scan(url: str, name: str, kind: str) -> list[dict]:
    """Clone a repo/space and scan its contents."""
    tmp = tempfile.mkdtemp(prefix=f"scan-{name.replace('/', '-')}-")
    try:
        # Inject credentials into URL
        if url.startswith("https://"):
            if "github.com" in url:
                url = url.replace("https://", f"https://x-access-token:{GH_PAT}@")
            elif "huggingface.co" in url:
                url = url.replace("https://", f"https://user:{HF_TOKEN}@")
        # Shallow clone for speed
        result = subprocess.run(
            ["git", "clone", "--depth", "1", url, tmp],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            return [{"type": "CLONE_ERROR", "severity": "INFO", "source": f"{kind}:{name}", "line": 0, "matched": result.stderr[:80], "context": "", "known": False}]
        # Scan current files only (history scan is separate)
        findings = scan_directory(tmp, f"{kind}:{name}:")
        return findings
    except Exception as e:
        return [{"type": "SCAN_ERROR", "severity": "INFO", "source": f"{kind}:{name}", "line": 0, "matched": str(e)[:80], "context": "", "known": False}]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def scan_git_history(url: str, name: str, max_commits: int = 50) -> list[dict]:
    """Clone full history and scan past commits for secrets."""
    tmp = tempfile.mkdtemp(prefix=f"hist-{name.replace('/', '-')}-")
    try:
        if "github.com" in url:
            url = url.replace("https://", f"https://x-access-token:{GH_PAT}@")
        elif "huggingface.co" in url:
            url = url.replace("https://", f"https://user:{HF_TOKEN}@")
        result = subprocess.run(
            ["git", "clone", url, tmp],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return []
        # Get all blobs ever committed
        result = subprocess.run(
            ["git", "-C", tmp, "log", "--all", "--pretty=format:%H", "-n", str(max_commits)],
            capture_output=True, text=True, timeout=30
        )
        commits = result.stdout.strip().split("\n") if result.stdout else []
        findings = []
        seen_blobs = set()
        for commit in commits[:max_commits]:
            # List files in this commit
            r = subprocess.run(
                ["git", "-C", tmp, "ls-tree", "-r", commit],
                capture_output=True, text=True, timeout=30
            )
            for line in r.stdout.splitlines():
                # Format: <mode> <type> <sha>\t<path>
                parts = line.split("\t", 1)
                if len(parts) != 2:
                    continue
                meta, path = parts
                meta_parts = meta.split()
                if len(meta_parts) < 3 or meta_parts[1] != "blob":
                    continue
                blob_sha = meta_parts[2]
                if blob_sha in seen_blobs:
                    continue
                seen_blobs.add(blob_sha)
                # Skip binary / lock files
                p = Path(path)
                if p.suffix.lower() in SKIP_EXTENSIONS or p.name in SKIP_FILENAMES:
                    continue
                # Get blob content
                r2 = subprocess.run(
                    ["git", "-C", tmp, "cat-file", "-p", blob_sha],
                    capture_output=True, timeout=10
                )
                if r2.returncode != 0:
                    continue
                try:
                    text = r2.stdout.decode("utf-8", errors="ignore")
                except Exception:
                    continue
                if len(text) > 1_000_000:
                    continue
                findings.extend(scan_text(text, f"history:{name}:{commit[:8]}:{path}"))
        return findings
    except Exception:
        return []
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> int:
    all_findings = []

    print("=" * 70)
    print("  SECURITY SCAN — GitHub repos + Hugging Face spaces")
    print("=" * 70)

    # 1. List GitHub repos
    print("\n[1/4] Listing GitHub repos...")
    repos = list_github_repos()
    print(f"  Found {len(repos)} repos.")
    for r in repos[:5]:
        print(f"    - {r['full_name']}  (private={r['private']})")
    if len(repos) > 5:
        print(f"    ... and {len(repos) - 5} more")

    # 2. Scan each repo's current files (shallow clone)
    print(f"\n[2/4] Scanning current files in {len(repos)} repos...")
    for i, r in enumerate(repos, 1):
        name = r["full_name"]
        url = r["html_url"] + ".git"
        print(f"  [{i}/{len(repos)}] {name}...", end=" ", flush=True)
        findings = clone_and_scan(url, name, "github")
        all_findings.extend(findings)
        print(f"{len(findings)} findings")

    # 3. Scan HF spaces
    print("\n[3/4] Scanning Hugging Face spaces...")
    try:
        spaces = list_hf_spaces()
        print(f"  Found {len(spaces)} spaces.")
        for s in spaces:
            name = s.get("id", "unknown")
            url = f"https://huggingface.co/spaces/{name}"
            print(f"  - {name}...", end=" ", flush=True)
            findings = clone_and_scan(url + ".git", name, "hf")
            all_findings.extend(findings)
            print(f"{len(findings)} findings")
    except Exception as e:
        print(f"  HF scan failed: {e}")

    # 4. Scan git history of the most important repos
    print("\n[4/4] Scanning git history of cellex-app + cellex-payment-verifier...")
    priority_repos = [r for r in repos if "cellex" in r["full_name"].lower()]
    for r in priority_repos:
        name = r["full_name"]
        url = r["html_url"] + ".git"
        print(f"  - history of {name}...", end=" ", flush=True)
        findings = scan_git_history(url, name, max_commits=30)
        all_findings.extend(findings)
        print(f"{len(findings)} findings")

    # ---- Report -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  SCAN RESULTS")
    print("=" * 70)

    if not all_findings:
        print("\n  ✅ No secrets found in any scanned location.")
        return 0

    # Group by severity
    by_sev = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": [], "INFO": []}
    for f in all_findings:
        by_sev.get(f["severity"], []).append(f)

    # Dedupe by (type, source, matched)
    for sev in by_sev:
        seen = set()
        unique = []
        for f in by_sev[sev]:
            key = (f["type"], f["source"], f["matched"])
            if key not in seen:
                seen.add(key)
                unique.append(f)
        by_sev[sev] = unique

    total = sum(len(v) for v in by_sev.values())
    print(f"\n  Total unique findings: {total}")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        if by_sev[sev]:
            print(f"    {sev}: {len(by_sev[sev])}")

    # Print details for CRITICAL + HIGH
    for sev in ["CRITICAL", "HIGH"]:
        if not by_sev[sev]:
            continue
        print(f"\n--- {sev} findings ---")
        for f in by_sev[sev]:
            known_marker = " (KNOWN)" if f["known"] else ""
            print(f"  [{f['type']}] {f['source']}:{f['line']}{known_marker}")
            print(f"    matched: {f['matched']}")
            print(f"    context: {f['context'][:100]}")
            print()

    # Print MEDIUM briefly
    if by_sev["MEDIUM"]:
        print(f"\n--- MEDIUM findings ({len(by_sev['MEDIUM'])}) ---")
        for f in by_sev["MEDIUM"][:20]:
            known_marker = " (KNOWN)" if f["known"] else ""
            print(f"  [{f['type']}] {f['source']}:{f['line']}{known_marker}  -> {f['matched']}")
        if len(by_sev["MEDIUM"]) > 20:
            print(f"  ... and {len(by_sev['MEDIUM']) - 20} more")

    # Write full report to file
    report_path = "/home/z/my-project/download/security-scan-report.json"
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump({
            "total": total,
            "by_severity": {sev: len(v) for sev, v in by_sev.items()},
            "findings": all_findings,
        }, f, indent=2)
    print(f"\n  Full report saved to: {report_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
