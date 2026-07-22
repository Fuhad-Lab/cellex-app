# Task 37 — Futuristic Design System Rebrand

**Agent:** main (super-z)
**Task ID:** 37
**Scope:** Apply the dark-theme futuristic design system (fx-* classes) to every page in the Cellex app.

## What was done

### Phase 1 — globals.css legacy class refresh
Updated all legacy helper classes in `/home/z/my-project/src/app/globals.css` that had hardcoded black/white colors from the old IG-inspired light theme. The new dark theme uses:
- Dark smoke background `#050508`
- Indigo accents `#6366f1` / `#4f46e5`
- Glassmorphism with `rgba(255,255,255,0.06)` backgrounds + `blur(16-25px)`

Classes refreshed: `.brand-gradient`, `.brand-text`, `.price`, `.urgency`, `.sale-badge`, `.btn-buy-now`, `.ig-logo`, `.ig-likes`, `.ig-caption`, `.ig-action-bar`, `.ig-icon-btn`, `.ig-topbar`, `.glass-topbar`, `.glass-nav`, `.glass`, `.glass-card`, `.glass-modal`, `.glass-input`, `.glass-section`, `.ig-card`, `.ig-cart-card`, `.ig-feed-card`, `.ig-media`, `.ig-post-grid`, `.ig-gradient-border`, `.ig-hero-bg`, `.ig-btn-primary`, `.ig-btn-outline`, `.ig-search-input`, `.ig-tab.active`, `.ig-shimmer`, `.ig-skeleton`, `.skeleton`, `.shimmer`, `.page-transition`, `.loading-dots span`, `body` background.

### Phase 2 — Per-file className substitutions
Wrote `/home/z/my-project/rebrand.py` — a Python script with ~30 regex substitutions that runs across all 41 target files. Key substitutions:

| Pattern | Replacement | Rule |
|---|---|---|
| `ig-topbar` (not -offset) | `fx-topbar ig-topbar` | #11 |
| `glass-nav` | `fx-nav glass-nav` | #12 |
| `ig-card` (not -spaced/-cart) | `fx-card ig-card` | #13 |
| `text-[#ed4956]` | `text-red-400` | #9 |
| `bg-[#ed4956]` | `bg-red-500` | #10 |
| `text-black` (no /opacity) | `text-white` | #2, #8 |
| `text-neutral-{700..200}` | `text-slate-{300..700}` | #3 |
| `bg-black` (no /opacity) | `bg-indigo-600` | #1 |
| `bg-neutral-{50..900}` | `bg-white/{5..20}` | #4 |
| `bg-white` (no /opacity) | `bg-white/10` | #6 |
| `border-neutral-*` | `border-white/8` | #5 |
| `hover:bg-neutral-*` | `hover:bg-white/10` | #7 |
| `divide-neutral-*` / `ring-neutral-*` | `divide-white/8` / `ring-white/20` | #5 |
| Inline `#efefef`/`#f5f5f5`/`#fafafa`/`#f0f0f0` bg | `rgba(255,255,255,0.05/0.04)` | #4 |
| Inline `#000`/`#000000` bg | `#4f46e5` | #1 |
| Inline black text colors | `#ffffff` | #8 |

### Phase 3 — Post-script fixes (targeted one-liners)
- `fill-black` → `fill-indigo-600` (saved bookmark icon, play icon) in 2 files
- `border-t-black` → `border-t-indigo-600` (loading spinner) in `seller/layout.tsx`
- `bg-red-50`/`hover:bg-red-50` → `bg-red-500/10`/`hover:bg-red-500/10` with word-boundary regex
- Fixed `bg-red-500/100` (mangled by initial substring replace) → `bg-red-500` in 9 files
- Fixed `hover:bg-red-500/100` → `hover:bg-red-500/80` in 3 remaining files

## Files Modified

**41 total**: 1 `globals.css` + 40 page/component files (task list had `checkout/page.tsx` listed twice, so unique count is 40).

Full list with line-change counts is in `/home/z/my-project/worklog.md` Task 37 section.

## Build Verification

```bash
cd /home/z/my-project && cp next.config.web.ts next.config.ts && rm -rf .next && \
  NEXT_PUBLIC_API_BASE_URL=https://eesha-learn.onrender.com npm run build
```

Result:
- ✓ Compiled successfully in 19.0s
- ✓ Generating static pages using 1 worker (80/80) in 736.7ms
- All 80 routes built (49 static + 31 dynamic)
- 0 TypeScript errors, 0 ESLint warnings

## Issues Encountered

1. **bg-red-50 substring bug**: Initial `str.replace('bg-red-50', ...)` mangled `bg-red-500` → `bg-red-500/100` in 9 files (because `bg-red-500` contains `bg-red-50` as substring). Fixed by re-running with proper `\bbg-red-50\b(?!0)` regex and explicitly restoring `bg-red-500`.

2. **Duplicate `color` in `.ig-logo`**: Original CSS had `color: #ffffff !important` followed by `color: #000000` (later wins = black). Removed the duplicate, set to white.

3. **Body background `!important`**: A light gradient `linear-gradient(180deg, #f8f8f8, #ffffff, #f8f8f8) !important` was overriding the dark `--background: #050508`. Updated to dark smoke gradient.

4. **Duplicate file in task list**: `checkout/page.tsx` listed twice in the task spec — that's just one file, so actual unique count is 40 page/component files + 1 globals.css = 41 total modified files.

## Constraints honored

- ✅ Only visual styling (className + inline styles) — no logic, state, API, or DB changes
- ✅ All `'use client'` directives, imports, hooks, functions preserved
- ✅ Build passes with 0 errors
- ✅ No test code written (per project rules)

## Files for reference

- `/home/z/my-project/rebrand.py` — the rebrand script (kept for reproducibility/audit)
- `/home/z/my-project/src/app/globals.css` — refreshed legacy classes + existing fx-* system
- `/home/z/my-project/worklog.md` — Task 37 section appended
