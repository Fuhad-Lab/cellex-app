#!/usr/bin/env python3
"""
Rename EeshaMart → Cellex in frontend files.

Rules:
- Replace "EeshaMart" → "Cellex" (compound, no space)
- Replace "Eesha Mart" → "Cellex" (with space)
- Replace "EeshaMart AI" → "Cellex AI"
- Replace "Eesha Mart AI" → "Cellex AI"
- DO NOT replace "Eesha" alone (preserves the AI assistant name + folder paths)
- DO NOT replace "eeshamart" (lowercase, used in URLs/env vars/internal IDs)
- DO NOT replace in file paths, env var names, or folder names

Files to update:
- All .html files in repo root (index.html, ai-chat.html, search-result.html, etc.)
- All .html files in Eesha buying folder/
- All .js files in js/ and Eesha buying folder/js/
- All .css files
- shared/header.html
- splash.html, welcome.html, eeshapay-logo.html
"""
import os
import re
from pathlib import Path

REPO_ROOT = Path("/home/z/my-project/download/EeshaMart")

# Directories to process
DIRS_TO_PROCESS = [
    REPO_ROOT,                              # index.html, ai-chat.html, etc.
    REPO_ROOT / "Eesha buying folder",      # login, cart, checkout, etc.
    REPO_ROOT / "shared",                   # shared/header.html
    REPO_ROOT / "js",                       # JS files
]

# File extensions to process
EXTENSIONS = {".html", ".js", ".css"}

# Directories to SKIP (don't rename in these)
SKIP_DIRS = {
    ".git", "supabase", "telegram-bot", "web-server", "node_modules",
    "admin", "eesha selling folder", "skills", "mini-services",
    "eeshamart-ai-backend", "eeshamart-ai-space", "eeshamart-ai-clean",
    "eeshamart-ai-fresh", "eeshamart-ai-hf", "eesha-ai", "netlify",
    "upload", "src", "prisma", "dist", ".next", "ai-seller-assistant",
}

# Replacement rules (order matters — longer patterns first)
REPLACEMENTS = [
    # "EeshaMart AI" / "Eesha Mart AI" → "Cellex AI"
    ("Eesha Mart AI", "Cellex AI"),
    ("EeshaMart AI", "Cellex AI"),
    # "EeshaMart" / "Eesha Mart" → "Cellex"
    ("Eesha Mart", "Cellex"),
    ("EeshaMart", "Cellex"),
    # Note: we deliberately DO NOT replace "Eesha" alone —
    # that would change the AI assistant's name and folder paths.
]

def should_skip(path: Path) -> bool:
    """Check if path is in a skip directory."""
    for skip in SKIP_DIRS:
        if skip in path.parts:
            return True
    return False

def process_file(filepath: Path) -> tuple[int, int]:
    """Process a single file. Returns (matches_found, replacements_made)."""
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ⚠️  Could not read {filepath}: {e}")
        return (0, 0)

    original = content
    total_matches = 0
    total_replacements = 0

    for old, new in REPLACEMENTS:
        # Count matches before replacing
        matches = content.count(old)
        if matches > 0:
            content = content.replace(old, new)
            total_matches += matches
            total_replacements += matches

    if content != original:
        filepath.write_text(content, encoding="utf-8")
        print(f"  ✅ {filepath.relative_to(REPO_ROOT)}: {total_replacements} replacements")
        return (total_matches, total_replacements)

    return (0, 0)

def main():
    total_files = 0
    total_replacements = 0

    for base_dir in DIRS_TO_PROCESS:
        if not base_dir.exists():
            continue

        print(f"\n=== Processing: {base_dir.relative_to(REPO_ROOT) or '.'} ===")

        for filepath in base_dir.rglob("*"):
            if not filepath.is_file():
                continue
            if filepath.suffix not in EXTENSIONS:
                continue
            if should_skip(filepath):
                continue

            matches, replacements = process_file(filepath)
            if replacements > 0:
                total_files += 1
                total_replacements += replacements

    print(f"\n{'='*60}")
    print(f"✅ Done! {total_replacements} replacements in {total_files} files")
    print(f"\nNote: 'Eesha' (AI assistant name) was NOT changed.")
    print(f"Note: 'eeshamart' (lowercase, in URLs/env vars) was NOT changed.")
    print(f"Note: Folder paths like 'Eesha buying folder/' were NOT changed.")

if __name__ == "__main__":
    main()
