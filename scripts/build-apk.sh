#!/usr/bin/env bash
# scripts/build-apk.sh
# -----------------------------------------------------------------------------
# Builds the Cellex Next.js app into a static export, syncs it into the native
# Android project via Capacitor, then builds a release APK.
#
# Sequence:
#   1. Swap in next.config.apk.ts (output: export) as next.config.ts
#   2. Move src/app/api/ aside (dynamic routes can't be statically exported)
#   3. npm run build           -> ./out
#   4. Restore src/app/api/ and next.config.web.ts
#   5. npx cap sync android    -> copies ./out into the native project
#   6. ./gradlew assembleRelease
#
# This script is invoked by .github/workflows/build-android.yml on every push.
# -----------------------------------------------------------------------------
set -euo pipefail

# Print every command for easier CI debugging.
export PS4='+ ${BASH_SOURCE}:${LINENO}: '
set -x

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/6] Installing JS dependencies (if missing)"
if [ ! -d node_modules ]; then
  npm install --legacy-peer-deps
fi

echo "==> [2/6] Swap in next.config.apk.ts (output: export)"
# Backup the current next.config.ts so we can restore it after the build.
if [ -f next.config.ts ]; then
  cp next.config.ts /tmp/next.config.ts.bak
fi
if [ -f next.config.apk.ts ]; then
  cp next.config.apk.ts next.config.ts
else
  echo "ERROR: next.config.apk.ts not found — cannot build static export." >&2
  exit 1
fi

# Move /api routes aside — they're server-side route handlers and can't be
# part of a static export. The mobile app talks DIRECTLY to the deployed HF
# Space backend, so it doesn't need them.
API_DIR="src/app/api"
API_MOVED=0
if [ -d "$API_DIR" ]; then
  mv "$API_DIR" /tmp/cellex-api-safe
  API_MOVED=1
  echo "    -> temporarily moved $API_DIR -> /tmp/cellex-api-safe"
fi

# Make sure NEXT_PUBLIC_API_BASE_URL is set so the mobile app knows where to
# send API requests. Falls back to the live HF Space if not provided.
: "${NEXT_PUBLIC_API_BASE_URL:=https://eesha-learn.onrender.com}"
export NEXT_PUBLIC_API_BASE_URL

echo "==> [3/6] Building Next.js static export (NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL)"
rm -rf out .next
npm run build:export
if [ ! -d out ]; then
  echo "ERROR: next build did not produce ./out" >&2
  exit 1
fi

echo "==> [4/6] Restore src/app/api/ and next.config.web.ts"
if [ $API_MOVED -eq 1 ] && [ -d /tmp/cellex-api-safe ]; then
  mv /tmp/cellex-api-safe "$API_DIR"
fi
if [ -f next.config.web.ts ]; then
  cp next.config.web.ts next.config.ts
elif [ -f /tmp/next.config.ts.bak ]; then
  cp /tmp/next.config.ts.bak next.config.ts
fi

echo "==> [5/6] Capacitor sync (web -> native)"
# Add the Android platform if it doesn't exist yet (first build on a fresh CI runner).
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android

echo "==> [6/6] Building Android release APK"
cd android
./gradlew clean assembleRelease --no-daemon -PbuildDir=build

cd "$ROOT_DIR"
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo "==> APK built: $APK_PATH  ($APK_SIZE)"
else
  echo "ERROR: APK not found at $APK_PATH" >&2
  exit 1
fi

echo "==> Done. Run \`npx @capgo/cli bundle upload --channel production\` next."
