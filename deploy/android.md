# Android (Capacitor) build instructions

This guide explains how to package the web app into an Android APK using Capacitor.

Prerequisites
- Node.js 18+
- Java JDK 11+
- Android Studio with SDK and command-line tools
- Android virtual device (optional) or physical device for sideloading

Steps
1. Build the web app locally

```bash
npm ci
npm run clean
npm run build
npm run build:css
```

2. Install Capacitor (local project)

```bash
npm install --save-dev @capacitor/cli @capacitor/android
npx cap init
```

3. Add Android platform

```bash
npx cap add android
```

4. Copy web assets into native project

```bash
npx cap copy android
```

5. Open Android Studio

```bash
npx cap open android
```

In Android Studio: build an APK (Build -> Build Bundle(s) / APK(s) -> Build APK(s)) and then install on device. For release builds, configure signing in Android Studio.

Notes
- The app expects the service worker at /sw.js. Capacitor serves local assets; service worker registration should work with `start_url` set to `/`.
- If you prefer a Trusted Web Activity (TWA) instead of Capacitor, you'll need to host the site over HTTPS and follow the TWA setup docs.

*** End of file
