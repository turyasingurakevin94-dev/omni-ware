# Omni-Ware Manager — the phone app

The manager's desk for Android. It is `manager.html` (the same page a browser gets at
`/manager.html`) inside a native shell built with Capacitor 8 — the same shell
the buyer app uses (`apps/buyer`), with its own app id: `com.omniware.manager`.

## Build

```sh
cd apps/manager
npm ci
npm run build          # www/ from ../../manager.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `manager.html` or `apps/manager/` is built by
`.github/workflows/build-manager-app.yml`, which hands back an installable debug
APK under the run's **Artifacts**. It can also be run by hand from the
Actions tab ("Build manager app (Android)" → Run workflow).

## Updates without a store release

Like the buyer app, the installed app checks the live
`https://omni-ware.vercel.app/manager.html` now and then, keeps a newer copy on
the phone and switches to it the next time the app goes to the background —
never in the middle of taking a payment. A new APK is only needed when something under
`android/` changes.

## Who can sign in

A login whose shop membership has the role `manager` (see
`supabase/migrations/0115_manager_role.sql` for how to give somebody that role).
The owner can sign in too and sees the same screens.
