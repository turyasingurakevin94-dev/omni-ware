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

## Pushes

The daily digest is a push (0120 / 0127). The app is in the shop's Firebase
project (`telagon-b20bd`) as `com.omniware.owner`, and its
`android/app/google-services.json` is here, so the page asks for pushes as it
starts (`OWNER_PUSH_READY` in owner.html is `true`). It asks only on an install
from build 2 on (`pushInstalled`): an older install of this app has no
Firebase, and asking it for a token would close the app.

## Updates without a store release

The installed app checks the live `https://omni-ware.vercel.app/owner.html`
now and then, keeps a newer copy on the phone and switches to it the next time
the app goes to the background. A new APK is only needed when something under
`android/` changes.

## Who can sign in

An `owner` membership, or an admin's. The team works in their own apps.
