# Omni-Ware Sales — the phone app

The sales desk for Android. It is `sales.html` (the same page a browser gets at
`/sales.html`) inside a native shell built with Capacitor 8 — the same shell
the agent app uses (`apps/agent`), with its own app id: `com.omniware.sales`.

## Build

```sh
cd apps/sales
npm ci
npm run build          # www/ from ../../sales.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `sales.html` or `apps/sales/` is built by
`.github/workflows/build-sales-app.yml`, which hands back an installable debug
APK under the run's **Artifacts**.

## Updates without a store release

Like the agent app, the installed app checks the live
`https://omni-ware.vercel.app/sales.html` now and then, keeps a newer copy on
the phone and switches to it the next time the app goes to the background.
A store release is only needed when something under `android/` changes.

## Notifications

Push needs a Firebase Android app registered for `com.omniware.sales` and its
`google-services.json` placed in `android/app/`. Without it the app builds and
runs; it just doesn't receive push.
