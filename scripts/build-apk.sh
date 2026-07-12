#!/bin/bash
set -e
echo "=== Building APK static export ==="
cp next.config.ts next.config.web.ts
cp next.config.apk.ts next.config.ts
mv src/app/api /tmp/cellex-api-safe
rm -rf .next
npm run build
mv /tmp/cellex-api-safe src/app/api
cp next.config.web.ts next.config.ts
npx cap sync android 2>/dev/null || echo "(Run npm run cap:add:android first)"
echo "✅ Static export ready in /out"
