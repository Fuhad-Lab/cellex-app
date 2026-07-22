#!/usr/bin/env python3
"""
Cellex Rebrand Script — Task 37
Applies the futuristic dark-theme design system to every page.
ONLY changes className attributes and inline styles. No logic changes.
"""
import re
import sys
from pathlib import Path

# 40 target files (from the task spec)
TARGET_FILES = [
    "src/app/page.tsx",
    "src/app/categories/page.tsx",
    "src/app/product/page.tsx",
    "src/app/cart/page.tsx",
    "src/app/checkout/page.tsx",
    "src/app/login/page.tsx",
    "src/app/profile/page.tsx",
    "src/app/settings/page.tsx",
    "src/app/search/page.tsx",
    "src/app/messenger/page.tsx",
    "src/app/ai-chat/page.tsx",
    "src/app/orders/page.tsx",
    "src/app/wishlist/page.tsx",
    "src/app/live/page.tsx",
    "src/app/live-watch/page.tsx",
    "src/app/videos/page.tsx",
    "src/app/shorts/page.tsx",
    "src/app/notifications/page.tsx",
    "src/app/sellers/page.tsx",
    "src/app/seller-dashboard/page.tsx",
    "src/app/become-seller/page.tsx",
    "src/app/group-buy/page.tsx",
    "src/app/group-buy-join/page.tsx",
    "src/app/payment/page.tsx",
    "src/app/create/page.tsx",
    "src/app/link-account/page.tsx",
    "src/app/telegram/page.tsx",
    "src/app/[slug]/storefront-client.tsx",
    "src/app/seller/profile/page.tsx",
    "src/app/seller/products/page.tsx",
    "src/app/seller/orders/page.tsx",
    "src/app/seller/videos/page.tsx",
    "src/app/seller/go-live/page.tsx",
    "src/app/seller/settings/page.tsx",
    "src/app/seller/stories/page.tsx",
    "src/app/seller/academy/page.tsx",
    "src/app/seller/preparing/page.tsx",
    "src/app/seller/layout.tsx",
    "src/components/mobile-nav.tsx",
    "src/components/global-spotlight.tsx",
    "src/components/spotlight-search.tsx",
]

ROOT = Path("/home/z/my-project")


def rebrand_text(text: str) -> str:
    """Apply all className/inline style substitutions to a file's content."""

    # ------------------------------------------------------------------
    # 1. Compound class additions (must come first, before any text/bg
    #    substitutions that might affect the class strings).
    #    Pattern: add fx-* prefix while keeping the original class for
    #    layout/positioning. Use negative lookbehind to avoid double-prefix.
    # ------------------------------------------------------------------
    # ig-topbar → fx-topbar ig-topbar (but NOT ig-topbar-offset)
    text = re.sub(r'(?<![\w-])ig-topbar(?!-)(?!\s*ig-topbar)', 'fx-topbar ig-topbar', text)
    # If somehow already prefixed twice, collapse
    text = re.sub(r'(fx-topbar\s+)+ig-topbar', 'fx-topbar ig-topbar', text)

    # glass-nav → fx-nav glass-nav
    text = re.sub(r'(?<![\w-])glass-nav(?![\w-])', 'fx-nav glass-nav', text)
    text = re.sub(r'(fx-nav\s+)+glass-nav', 'fx-nav glass-nav', text)

    # ig-card → fx-card ig-card (but NOT ig-card-spaced, ig-cart-card)
    text = re.sub(r'(?<![\w-])ig-card(?![-\w])', 'fx-card ig-card', text)
    text = re.sub(r'(fx-card\s+)+ig-card', 'fx-card ig-card', text)

    # ------------------------------------------------------------------
    # 2. Red color replacements (rule 9 & 10)
    # ------------------------------------------------------------------
    text = text.replace("text-[#ed4956]", "text-red-400")
    text = text.replace("bg-[#ed4956]", "bg-red-500")
    text = text.replace("border-[#ed4956]", "border-red-500")

    # ------------------------------------------------------------------
    # 3. Text color replacements (rules 3 & 8)
    #    Order matters: handle compound classes first.
    # ------------------------------------------------------------------
    # text-black (NOT text-black/opacity) → text-white
    text = re.sub(r'\btext-black(?![/\w-])', 'text-white', text)
    # hover:text-black → hover:text-white
    text = re.sub(r'\bhover:text-black(?![/\w-])', 'hover:text-white', text)

    # text-neutral-{N} → text-slate-{N} (light gray on dark bg)
    text = re.sub(r'\btext-neutral-700\b', 'text-slate-300', text)
    text = re.sub(r'\btext-neutral-600\b', 'text-slate-400', text)
    text = re.sub(r'\btext-neutral-500\b', 'text-slate-400', text)
    text = re.sub(r'\btext-neutral-400\b', 'text-slate-500', text)
    text = re.sub(r'\btext-neutral-300\b', 'text-slate-600', text)
    text = re.sub(r'\btext-neutral-200\b', 'text-slate-700', text)
    # hover variants
    text = re.sub(r'\bhover:text-neutral-700\b', 'hover:text-slate-300', text)
    text = re.sub(r'\bhover:text-neutral-600\b', 'hover:text-slate-400', text)
    text = re.sub(r'\bhover:text-neutral-500\b', 'hover:text-slate-400', text)

    # ------------------------------------------------------------------
    # 4. Background color replacements (rules 4, 5, 6, 7)
    # ------------------------------------------------------------------
    # bg-black (NOT bg-black/opacity, NOT on dark overlay contexts)
    # On CTA buttons → indigo gradient. Use bg-indigo-600 for safety
    # (fx-btn-primary would override padding/border-radius).
    text = re.sub(r'\bbg-black(?![/\w-])', 'bg-indigo-600', text)
    text = re.sub(r'\bhover:bg-black(?![/\w-])', 'hover:bg-indigo-700', text)

    # bg-neutral-{N} → bg-white/{opacity}
    text = re.sub(r'\bbg-neutral-50\b', 'bg-white/5', text)
    text = re.sub(r'\bbg-neutral-100\b', 'bg-white/5', text)
    text = re.sub(r'\bbg-neutral-150\b', 'bg-white/5', text)
    text = re.sub(r'\bbg-neutral-200\b', 'bg-white/10', text)
    text = re.sub(r'\bbg-neutral-300\b', 'bg-white/15', text)
    text = re.sub(r'\bbg-neutral-400\b', 'bg-white/20', text)
    text = re.sub(r'\bbg-neutral-700\b', 'bg-white/10', text)
    text = re.sub(r'\bbg-neutral-800\b', 'bg-white/10', text)
    text = re.sub(r'\bbg-neutral-900\b', 'bg-white/5', text)
    # hover variants
    text = re.sub(r'\bhover:bg-neutral-50\b', 'hover:bg-white/10', text)
    text = re.sub(r'\bhover:bg-neutral-100\b', 'hover:bg-white/10', text)
    text = re.sub(r'\bhover:bg-neutral-150\b', 'hover:bg-white/10', text)
    text = re.sub(r'\bhover:bg-neutral-200\b', 'hover:bg-white/10', text)
    text = re.sub(r'\bhover:bg-neutral-300\b', 'hover:bg-white/15', text)
    text = re.sub(r'\bhover:bg-neutral-700\b', 'hover:bg-white/10', text)

    # bg-white (NOT bg-white/opacity) → bg-white/10 (subtle glass on dark)
    text = re.sub(r'\bbg-white(?![/\w-])', 'bg-white/10', text)
    text = re.sub(r'\bhover:bg-white(?![/\w-])', 'hover:bg-white/15', text)

    # ------------------------------------------------------------------
    # 5. Border color replacements (rule 5)
    # ------------------------------------------------------------------
    text = re.sub(r'\bborder-neutral-100\b', 'border-white/8', text)
    text = re.sub(r'\bborder-neutral-200\b', 'border-white/8', text)
    text = re.sub(r'\bborder-neutral-300\b', 'border-white/8', text)
    text = re.sub(r'\bborder-neutral-400\b', 'border-white/10', text)
    text = re.sub(r'\bhover:border-neutral-200\b', 'hover:border-white/10', text)
    text = re.sub(r'\bhover:border-neutral-300\b', 'hover:border-white/10', text)
    text = re.sub(r'\bborder-black\b', 'border-white/10', text)

    # divide-neutral-* (Tailwind divide color utilities)
    text = re.sub(r'\bdivide-neutral-100\b', 'divide-white/8', text)
    text = re.sub(r'\bdivide-neutral-200\b', 'divide-white/8', text)

    # ring-neutral-*
    text = re.sub(r'\bring-neutral-300\b', 'ring-white/20', text)
    text = re.sub(r'\bring-neutral-400\b', 'ring-white/20', text)

    # from-/to-/via- neutral stops (gradient stops)
    text = re.sub(r'\bfrom-neutral-100\b', 'from-white/5', text)
    text = re.sub(r'\bfrom-neutral-200\b', 'from-white/10', text)
    text = re.sub(r'\bto-neutral-100\b', 'to-white/5', text)
    text = re.sub(r'\bto-neutral-200\b', 'to-white/10', text)

    # ------------------------------------------------------------------
    # 6. Inline style replacements (light grays → dark glass)
    # ------------------------------------------------------------------
    # Light gray inline backgrounds → dark glass
    text = text.replace("background: '#efefef'", "background: 'rgba(255,255,255,0.05)'")
    text = text.replace("background: '#f5f5f5'", "background: 'rgba(255,255,255,0.05)'")
    text = text.replace("background: '#fafafa'", "background: 'rgba(255,255,255,0.04)'")
    text = text.replace("background: '#f0f0f0'", "background: 'rgba(255,255,255,0.04)'")
    text = text.replace("background: '#ffffff'", "background: 'rgba(255,255,255,0.06)'")
    text = text.replace("background: '#fff'", "background: 'rgba(255,255,255,0.06)'")
    text = text.replace("background: '#000'", "background: '#4f46e5'")
    text = text.replace("background: '#000000'", "background: '#4f46e5'")
    text = text.replace("backgroundColor: '#efefef'", "backgroundColor: 'rgba(255,255,255,0.05)'")
    text = text.replace("backgroundColor: '#f5f5f5'", "backgroundColor: 'rgba(255,255,255,0.05)'")
    text = text.replace("backgroundColor: '#fafafa'", "backgroundColor: 'rgba(255,255,255,0.04)'")
    text = text.replace("backgroundColor: '#ffffff'", "backgroundColor: 'rgba(255,255,255,0.06)'")
    text = text.replace("backgroundColor: '#000'", "backgroundColor: '#4f46e5'")
    text = text.replace("backgroundColor: '#000000'", "backgroundColor: '#4f46e5'")

    # Inline color: black → white
    text = text.replace("color: '#000'", "color: '#ffffff'")
    text = text.replace("color: '#000000'", "color: '#ffffff'")
    text = re.sub(r"color:\s*'#262626'", "color: '#ffffff'", text)
    text = re.sub(r"color:\s*'#1a1a1a'", "color: '#ffffff'", text)

    # Border inline styles
    text = text.replace("borderColor: '#dbdbdb'", "borderColor: 'rgba(255,255,255,0.08)'")
    text = text.replace("borderColor: '#efefef'", "borderColor: 'rgba(255,255,255,0.08)'")

    return text


def main():
    changed = 0
    skipped = 0
    for rel in TARGET_FILES:
        path = ROOT / rel
        if not path.exists():
            print(f"  MISSING: {rel}")
            skipped += 1
            continue
        original = path.read_text(encoding="utf-8")
        updated = rebrand_text(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            # count number of changed lines for reporting
            diffs = sum(1 for a, b in zip(original.splitlines(), updated.splitlines()) if a != b)
            print(f"  ✓ {rel}  ({diffs} lines changed)")
            changed += 1
        else:
            print(f"  · {rel}  (no changes)")
    print(f"\nTotal: {changed} files modified, {skipped} missing")


if __name__ == "__main__":
    main()
