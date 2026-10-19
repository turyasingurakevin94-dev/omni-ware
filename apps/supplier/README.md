# Omni-Ware Supplier — the phone app

The supplier app for Android. It is `supplier.html` (the same page a browser
gets at `/supplier.html`) inside a native shell built with Capacitor 8, with
its own app id: `com.omniware.supplier`.

## Download

Every push to `main` that touches `supplier.html` or `apps/supplier/` is built
by `.github/workflows/build-supplier-app.yml`. The APK lands on the rolling
`supplier-app` release, at a link that never changes:

https://github.com/turyasingurakevin94-dev/omni-ware/releases/download/supplier-app/omniware-supplier.apk

## Build

```sh
cd apps/supplier
npm ci
npm run build          # www/ from ../../supplier.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

## How it differs from the browser page

- **No invite link.** On the web the shop's WhatsApp link carries `?s=<shop>`.
  The app has none, so signing in sends the phone and PIN alone and
  `supplier-portal` finds the shop from the phone, only for an account with a
  live PIN, and sends it back only once the PIN is right.
- **Always the live shop.** The environment block treats `window.Capacitor`
  as production, as in every app.
- **Fonts on the phone.** `build-www.js` swaps Google Fonts for local copies
  and drops the web manifest and service worker.
- **No push yet.** There is no Firebase app for `com.omniware.supplier`, so no
  `google-services.json`. Messages reach suppliers on WhatsApp.

## Updates

The page is inside the APK, so a change to `supplier.html` needs a new APK.
Debug builds are signed with the runner's key, which differs on every run;
until the repo secret `ANDROID_DEBUG_KEYSTORE_B64` is set (see the workflow),
a phone has to uninstall the old app before installing a newer one.
