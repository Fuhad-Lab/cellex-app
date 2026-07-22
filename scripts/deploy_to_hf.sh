#!/bin/bash
# Sync the Next.js app from /home/z/my-project to the cloned HF Space repo,
# then commit and push.

set -e

SRC=/home/z/my-project
DEST=/home/z/my-project/deploy/cellex-web-hf

# === Step 1: Wipe the destination (preserving .git and .gitattributes) ===
echo "=== Wiping old content in HF Space clone ==="
cd "$DEST"
find . -maxdepth 1 \
  ! -name '.' \
  ! -name '.git' \
  ! -name '.gitattributes' \
  -exec rm -rf {} +
ls -la | head -10
echo ""

# === Step 2: Copy the Next.js app ===
echo "=== Copying Next.js app from source ==="
cd "$SRC"

# Directories we want
mkdir -p "$DEST/src" "$DEST/public"

# Root config files
cp package.json "$DEST/"
cp package-lock.json "$DEST/" 2>/dev/null || cp bun.lock "$DEST/" 2>/dev/null || true
cp next.config.ts "$DEST/"
cp tsconfig.json "$DEST/"
cp tailwind.config.ts "$DEST/"
cp postcss.config.mjs "$DEST/"
cp components.json "$DEST/"
cp eslint.config.mjs "$DEST/"
cp next-env.d.ts "$DEST/"
cp Dockerfile "$DEST/"
cp README.md "$DEST/"
cp .hfignore "$DEST/"
cp .gitignore "$DEST/" 2>/dev/null || true

# Source dirs
cp -r src/ "$DEST/src/"
cp -r public/ "$DEST/public/" 2>/dev/null || true

# prisma (for build if needed)
cp -r prisma/ "$DEST/prisma/" 2>/dev/null || true

# supabase folder (for tracking, optional)
cp -r supabase/ "$DEST/supabase/" 2>/dev/null || true

echo "Copied. Final structure:"
cd "$DEST"
ls -la | head -25
echo ""

# === Step 3: Commit & push ===
echo "=== Committing and pushing ==="
cd "$DEST"
git add -A
git status | head -20

# Configure git user if not set
git config user.email "eeshaai@cellex.shop" 2>/dev/null || true
git config user.name "eeshaAI" 2>/dev/null || true

git commit -m "feat: Migrate frontend from static HTML to Next.js 16 App Router

- All 16 buyer pages: home, login, product, cart, checkout, payment,
  categories, search, seller-profile, profile, orders, wishlist,
  videos, live, live-watch, group-buy, ai-chat, link-account, telegram
- 7 seller dashboard pages with shared sidebar layout
- 22 API route proxies to existing Supabase Edge Functions
- Suspense boundaries for useSearchParams pages
- Standalone output build for Docker deployment
- Dockerfile (multi-stage Node 20 alpine, port 7860)
- README with HF Space YAML frontmatter
- .hfignore for lean Docker context

Backend unchanged: 27 Supabase Edge Functions, Render bot, OpenWA,
PalmPay payment verifier — all remain in place." 2>&1 | tail -5

echo ""
echo "=== Pushing to HF ==="
git push origin main 2>&1 | tail -10

echo ""
echo "=== Done ==="
echo "Space URL: https://eeshaai-cellex-web.hf.space"
