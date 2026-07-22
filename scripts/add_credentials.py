#!/usr/bin/env python3
"""Add credentials: 'include' to all fetch() calls that use API_BASE."""
import re
from pathlib import Path

SRC_DIR = Path('/home/z/my-project/src')
files_modified = 0

for tsx in list(SRC_DIR.rglob('*.tsx')) + list(SRC_DIR.rglob('*.ts')):
    if 'node_modules' in str(tsx) or '.next' in str(tsx):
        continue
    text = tsx.read_text()
    if 'API_BASE' not in text or 'credentials' in text:
        continue  # Skip files that don't use API_BASE or already have credentials

    original = text
    # Pattern: fetch(`...`, { followed by method/headers/body but no credentials
    # Add credentials: 'include' after the opening { of the fetch options
    # The pattern: fetch(`...`, {\n followed by method: or headers:
    text = re.sub(
        r"(fetch\(`\$\{API_BASE\}/api/[^`]+`,\s*\{)",
        r"\1\n      credentials: 'include',",
        text
    )

    if text != original:
        tsx.write_text(text)
        files_modified += 1
        print(f"  ✓ {tsx.relative_to(SRC_DIR)}")

print(f"\nModified {files_modified} files.")
