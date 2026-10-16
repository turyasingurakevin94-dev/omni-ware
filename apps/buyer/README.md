# Omni-Ware Buyer — the phone app

The buying desk for Android. It is `buyer.html` (the same page a browser gets at
`/buyer.html`) inside a native shell built with Capacitor 8 — the same shell
the sales app uses (`apps/sales`), with its own app id: `com.omniware.buyer`.

## Build

```sh
cd apps/buyer
npm ci
npm run build          # www/ from ../../buyer.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `buyer.html` or `apps/buyer/` is built by
`.github/workflows/build-buyer-app.yml`, which hands back an installable debug
APK under the run's **Artifacts**. It can also be run by hand from the
Actions tab ("Build buyer app (Android)" → Run workflow).

## Updates without a store release

Like the sales app, the installed app checks the live
`https://omni-ware.vercel.app/buyer.html` now and then, keeps a newer copy on
the phone and switches to it the next time the app goes to the background —
never in the middle of a trip. A new APK is only needed when something under
`android/` changes.
