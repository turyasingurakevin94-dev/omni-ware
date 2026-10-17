# Omni-Ware Accounts — the phone app

The accounts desk for Android. It is `accounts.html` (the same page a browser
gets at `/accounts.html`) inside a native shell built with Capacitor 8 — the
same shell the sales and buyer apps use (`apps/sales`, `apps/buyer`), with its
own app id: `com.omniware.accounts`.

## Build

```sh
cd apps/accounts
npm ci
npm run build          # www/ from ../../accounts.html (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `accounts.html` or `apps/accounts/` is built
by `.github/workflows/build-accounts-app.yml`, which hands back an installable
debug APK under the run's Artifacts. It can also be started by hand from the
Actions tab ("Build accounts app (Android)" → Run workflow).

## Updates without a store release

Like the sales and buyer apps, the installed app checks the live
`https://omni-ware.vercel.app/accounts.html` now and then, keeps a newer copy on
the phone and switches to it the next time the app goes to the background —
never in the middle of a count. A new APK is only needed when something under
`android/` changes.

## Who can sign in

An `accounts` membership (migration `0115_accounts_role.sql`), or an owner,
admin or manager. Each thing the page writes needs its task in `role_tasks`;
the owner switches them on.
