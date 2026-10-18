# Omni-Ware Sourcing — the phone app

The Sourcing desk for Android. It is `sourcing.html` (the same page a browser
gets at `/sourcing.html`) inside a native shell built with Capacitor 8 — the
same shell the sales and buyer apps use (`apps/sales`, `apps/buyer`), with its
own app id: `com.omniware.sourcing`.

## Build

```sh
cd apps/sourcing
npm ci
npm run build          # www/ from ../../sourcing.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `sourcing.html` or `apps/sourcing/` is built
by `.github/workflows/build-sourcing-app.yml`, which hands back an installable
debug APK under the run's Artifacts. It can also be started by hand from the
Actions tab ("Build sourcing app (Android)" → Run workflow).

## Updates without a store release

Like the sales and buyer apps, the installed app checks the live
`https://omni-ware.vercel.app/sourcing.html` now and then, keeps a newer copy on
the phone and switches to it the next time the app goes to the background —
never in the middle of a visit. A new APK is only needed when something under
`android/` changes.

## Who can sign in

A `sourcing` membership (the role comes with `0128_sourcing_role.sql`;
its tasks with `0126_sourcing.sql`), or an owner or admin. Each thing the page
writes needs its task in `role_tasks`.
