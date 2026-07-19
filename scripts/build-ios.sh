#!/usr/bin/env bash
set -euo pipefail
export PS4='+ ${BASH_SOURCE}:${LINENO}: '
set -x

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/7] Installing JS dependencies"
if [ ! -d node_modules ]; then npm install --legacy-peer-deps; fi

echo "==> [2/7] Swap in next.config.apk.ts"
if [ -f next.config.ts ]; then cp next.config.ts /tmp/next.config.ts.bak; fi
cp next.config.apk.ts next.config.ts

API_DIR="src/app/api"
API_MOVED=0
if [ -d "$API_DIR" ]; then mv "$API_DIR" /tmp/cellex-api-safe; API_MOVED=1; fi

: "${NEXT_PUBLIC_API_BASE_URL:=https://eesha-learn.onrender.com}"
export NEXT_PUBLIC_API_BASE_URL

echo "==> [3/7] Building Next.js static export"
rm -rf out .next
npm run build:export

echo "==> [4/7] Restore config"
if [ $API_MOVED -eq 1 ] && [ -d /tmp/cellex-api-safe ]; then mv /tmp/cellex-api-safe "$API_DIR"; fi
if [ -f next.config.web.ts ]; then cp next.config.web.ts next.config.ts; fi

echo "==> [5/7] Capacitor sync iOS"
if [ ! -d ios ]; then npx cap add ios; fi
npx cap sync ios

echo "==> [6/7] Patch ViewController.swift — enable native iOS swipe-back"
VC_FILE=$(find ios -name "ViewController.swift" -path "*/App/*" | head -1)
if [ -z "$VC_FILE" ]; then VC_FILE="ios/App/App/ViewController.swift"; fi

if [ -f "$VC_FILE" ]; then
  if ! grep -q "allowsBackForwardNavigationGestures" "$VC_FILE"; then
    if grep -q "viewDidLoad" "$VC_FILE"; then
      sed -i '/super.viewDidLoad()/a\
        if let webView = self.webView {\
            webView.allowsBackForwardNavigationGestures = true\
        }' "$VC_FILE"
    else
      cat >> "$VC_FILE" << 'SWIFT'

    override func viewDidLoad() {
        super.viewDidLoad()
        if let webView = self.webView {
            webView.allowsBackForwardNavigationGestures = true
        }
    }
SWIFT
    fi
    echo "    -> patched with allowsBackForwardNavigationGestures = true"
  fi
fi

echo "==> [7/7] Build iOS (unsigned)"
cd ios
WORKSPACE=$(find . -name "*.xcworkspace" -maxdepth 3 | head -1)
SCHEME=$(xcodebuild -workspace "$WORKSPACE" -list 2>/dev/null | grep -A5 "Schemes:" | tail -1 | xargs || echo "App")
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build

cd "$ROOT_DIR"
APP_PATH="ios/build/Build/Products/Release-iphoneos/App.app"
if [ -d "$APP_PATH" ]; then
  mkdir -p /tmp/Payload && cp -r "$APP_PATH" /tmp/Payload/
  cd /tmp && zip -r "$ROOT_DIR/ios/build/Cellex-unsigned.ipa" Payload && rm -rf /tmp/Payload
  echo "==> IPA: ios/build/Cellex-unsigned.ipa"
fi
