#!/usr/bin/env python3
"""Add pt-[54px] (topbar offset) to every page that uses .ig-topbar.

For each file that contains className="ig-topbar", find the OUTER container
div (usually className="ig-container bg-white min-h-screen ...") and add
pt-[54px] to it so content doesn't slide under the now-fixed topbar.

Strategy: look for the FIRST div that opens AFTER the 'use client' line and
contains 'ig-container' or 'min-h-screen' in its className. Add pt-[54px]
to that className if not already present.

ALSO handle special cases:
- Some pages have the topbar NOT inside an ig-container (e.g. they use a
  different wrapper). For those, we add pt-[54px] to the topbar's sibling.
- Some pages have multiple topbars (e.g. product page has 2). We only add
  the offset once per page.
"""
import re
from pathlib import Path

PAGES_DIR = Path('/home/z/my-project/src/app')
COMPONENTS_DIR = Path('/home/z/my-project/src/components')

# Find all files using ig-topbar
files_with_topbar = []
for p in PAGES_DIR.rglob('page.tsx'):
    text = p.read_text()
    if 'ig-topbar' in text and 'ig-topbar-offset' not in text and 'pt-[54px]' not in text:
        files_with_topbar.append(p)

print(f"Found {len(files_with_topbar)} pages with .ig-topbar (no offset yet):")
for p in files_with_topbar:
    print(f"  - {p.relative_to(PAGES_DIR)}")

print()
print("Processing...")

# Strategy: for each file, find the FIRST opening div tag that has
# ig-container OR min-h-screen in its className, and add pt-[54px] to it.
# This is the page's root content wrapper.

modified_count = 0
for p in files_with_topbar:
    text = p.read_text()
    original = text

    # Pattern: <div className="...ig-container...min-h-screen...">
    # We want to add pt-[54px] to the className.
    # Match the first div with ig-container in its className.
    pattern = re.compile(
        r'(<div\s+className=")([^"]*\big-container\b[^"]*)(")'
    )
    match = pattern.search(text)
    if not match:
        # Try min-h-screen without ig-container
        pattern2 = re.compile(
            r'(<div\s+className=")([^"]*\bmin-h-screen\b[^"]*)(")'
        )
        match = pattern2.search(text)

    if match:
        prefix, classname, suffix = match.group(1), match.group(2), match.group(3)
        if 'pt-[54px]' not in classname and 'ig-topbar-offset' not in classname:
            new_classname = classname + ' pt-[54px]'
            new_text = text[:match.start()] + prefix + new_classname + suffix + text[match.end():]
            p.write_text(new_text)
            modified_count += 1
            print(f"  ✓ {p.relative_to(PAGES_DIR)}: added pt-[54px] to root div")
        else:
            print(f"  - {p.relative_to(PAGES_DIR)}: already has offset, skipping")
    else:
        print(f"  ✗ {p.relative_to(PAGES_DIR)}: no matching root div found (manual review needed)")

print()
print(f"Modified {modified_count}/{len(files_with_topbar)} files.")
