# Native Gesture Setup — iOS & Android

This document explains how to enable native swipe-back gestures on both
platforms. These changes require modifying the native iOS/Android project
files (not just the web code).

## iOS — Native Swipe-Back Gesture

Capacitor's WKWebView needs `allowsBackForwardNavigationGestures = true`
to enable the native iOS edge-swipe-to-go-back animation.

### Step 1: Open the iOS project

```bash
cd /home/z/my-project
npx cap open ios
```

### Step 2: Edit ViewController.swift

In Xcode, open `App/App/ViewController.swift` and add this to the
`viewDidLoad()` method:

```swift
override func viewDidLoad() {
    super.viewDidLoad()

    // Enable native iOS swipe-back gesture in WKWebView
    if let webView = self.webView {
        webView.allowsBackForwardNavigationGestures = true
    }
}
```

If `ViewController.swift` doesn't have a `viewDidLoad()` method, add the
whole method. If the file doesn't exist, create it:

```swift
import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        if let webView = self.webView {
            webView.allowsBackForwardNavigationGestures = true
        }
    }
}
```

### Step 3: Build and run

```bash
npx cap sync ios
npx cap open ios
# In Xcode: Product → Run (or Archive for App Store)
```

Now when a user swipes from the left edge on any page, iOS's native
screenshot-based back animation plays — no JavaScript involved.

---

## Android — Predictive Back Gesture

Android 13+ supports "Predictive Back" which shows the previous page
peeking in as you swipe. This requires a manifest change.

### Step 1: Open the Android project

```bash
cd /home/z/my-project
npx cap open android
```

### Step 2: Edit AndroidManifest.xml

Open `android/app/src/main/AndroidManifest.xml` and add
`android:enableOnBackInvokedCallback="true"` to the `<application>` tag:

```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:enableOnBackInvokedCallback="true"
    android:theme="@style/AppTheme">
```

### Step 3: The back-button listener (already done)

The `NativeBackGesture` component in `src/components/native-back-gesture.tsx`
already handles the Android back-button event. When a user swipes from
the edge (or presses the hardware back button), it calls `router.back()`
to navigate back in Next.js history. On the homepage, it exits the app.

### Step 4: Build and run

```bash
npx cap sync android
npx cap open android
# In Android Studio: Run → Run 'app' (or Build → Generate Signed Bundle)
```

---

## Telegram-Style Swipe Actions (both platforms)

We installed `@use-gesture/react` + `@react-spring/web` for physics-based
drag interactions. Two components are ready to use:

### SwipeableRow — swipe left to reveal delete/archive buttons

```tsx
import { SwipeableRow } from '@/components/swipeable-row';

<SwipeableRow onDelete={() => removeItem(item.id)}>
  <div className="p-3 border-b border-neutral-100">
    {item.name}
  </div>
</SwipeableRow>
```

### SwipeableCard — swipe away to dismiss

```tsx
import { SwipeableCard } from '@/components/swipeable-row';

<SwipeableCard onDismiss={() => dismiss(notification.id)}>
  <div className="p-3 bg-white rounded-lg">
    {notification.message}
  </div>
</SwipeableCard>
```

Both work identically on iOS and Android with native-feeling spring physics.
