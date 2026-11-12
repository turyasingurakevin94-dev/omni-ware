# Omni-Ware Store — the phone app

The store yard for Android. It is the new Store app, `store.html` built from
`src/apps/store` with its area files `store-<area>.js` (the same page a browser
gets at `/store.html`; switched 2026-11-12, `docs/rebuild.md`), inside a native shell built with Capacitor 8 — the same shell
the buyer and sales apps use (`apps/buyer`, `apps/sales`), with its own app id:
`com.omniware.store`, so it installs beside them.

## Build

```sh
cd apps/store
npm ci
npm run build          # www/ from ../../store.html and its area files (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

Every push to `main` that touches `store.html`, its files, `src/` or `apps/store/` is built by
`.github/workflows/build-store-app.yml`, which hands back an installable debug
APK under the run's **Artifacts**. It can also be run by hand from the
Actions tab ("Build store app (Android)" → Run workflow).

## Before the first install

- Run `supabase/migrations/0115_store_role.sql` in the SQL editor. Without it
  the app still packs, loads and delivers, but checking a trip in at the yard,
  stock takes and locked routes say they need it.
- Give the person the Store role and a staff row (see the top of 0115).
- **Alerts** (push) need a Firebase Android app for `com.omniware.store`:
  download its `google-services.json` into `android/app/`. Without it the app
  works and the Alerts switch says it is not set up.
- **The yard's pushes** are `0183` (`docs/live/apply-0183.sql` on the live
  books): it sends every handover the yard takes part in, the count to Ruth
  included. Once it is in, turn off the old `notify-worker` and
  `notify-stock-count` Database Webhooks, or those pushes come twice.

## Updates without a store release

Like the other apps, the installed app checks the live
`https://omni-ware.vercel.app/store.html` now and then, keeps a newer copy (the
page and every file its `ow-files` names, all of one build) on the phone and
switches to it the next time the app goes to the background — never in the
middle of a pick. It refuses any page that is not a build of the new app
(`src/native/update.ts`). The native layer is the shared `src/native`, wired
by `src/apps/store/shell/native.ts` (Back, the bars, the update, the pushes).
Installed old Store apps take the new page by their own live update (same key
`ow-store-bundle`). A new APK is only needed when something under
`android/` changes.

## The camera and the map

The delivery photo uses the phone's camera from inside the page (the
`CAMERA` permission is in the manifest). The Load map draws OpenStreetMap
tiles and keeps every tile it has shown on the phone, so the yard's own part
of Kampala opens with no signal. Road routes are asked once of the
OpenStreetMap router and locked in `place_routes` for the whole shop.
