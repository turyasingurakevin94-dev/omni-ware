# Omni-Ware Owner — the phone app

What only the owner decides, for Android: hiring and pay, each role's task
switches, the policy numbers, the one-time set-up, backups, and the log of
every decision made for the owner (docs/decision-rights.md, section 4). It is
`owner.html` (the same page a browser gets at `/owner.html`) inside the same
Capacitor 8 shell as the other role apps, with its own app id:
`com.omniware.owner`.

## Build

```sh
cd apps/owner
npm ci
npm run build          # www/ from ../../owner.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `owner.html` or `apps/owner/` is built by
`.github/workflows/build-owner-app.yml`, which hands back an installable debug
APK under the run's Artifacts.

## Pushes: one step for the owner first

The daily digest is a push (0120 / 0127). The shop's Firebase project
(`telagon-b20bd`) does not have this app yet, so there is no
`android/app/google-services.json` here and the page does not ask for pushes
(`OWNER_PUSH_READY` in owner.html is `false`) — asking without the file can
close the app on open. To switch pushes on:

1. In the Firebase console, add an Android app with the package name
   `com.omniware.owner`.
2. Download the new `google-services.json` and put it at
   `apps/owner/android/app/google-services.json`.
3. In the same commit, set `OWNER_PUSH_READY = true` in owner.html and raise
   `versionCode` in `android/app/build.gradle` to 2 (`versionName` 1.1): the
   page asks for a token only on an install from build 2 on
   (`pushInstalled`), so an older install never asks and never closes.
   `test/owner-native-app.test.js` holds the two together.

Until then the digest still lands in the log, and the browser and the app show
it there.

## Updates without a store release

The installed app checks the live `https://omni-ware.vercel.app/owner.html`
now and then, keeps a newer copy on the phone and switches to it the next time
the app goes to the background. A new APK is only needed when something under
`android/` changes.

## Who can sign in

An `owner` membership, or an admin's. The team works in their own apps.
