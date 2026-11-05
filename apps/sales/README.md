# Omni-Ware Sales — the phone app

The sales desk for Android. It is the new Sales app — `next/sales.html` and its
tab files, built from `src/apps/sales` by `npm run build:sales`
(`docs/spec/07-stack.md` §4) — inside a native shell built with Capacitor 8,
the same shell the agent app uses (`apps/agent`), with its own app id:
`com.omniware.sales`. The old `sales.html` at the root is no longer in the app.

## Build

```sh
npm run build:sales    # at the repo root: next/ from src/ (committed)
cd apps/sales
npm ci
npm run build          # www/ from ../../next/ (never edit www/ by hand)
npx cap sync android
cd android && ./gradlew assembleDebug
```

`www/` holds the page through the phone's swaps (`src/transform.js`: the fonts
and the Supabase client from inside the app), every file the page names in
`<meta name="ow-files">`, the demo (so `www/index.html?demo` can be checked
without a login), and `bundle.json`. The build fails if a swap misses, a CDN
link is left, a named file is missing or of another build, or the page has no
native layer.

Every push to `main` that touches `next/`, `src/` or `apps/sales/` is built by
`.github/workflows/build-sales-app.yml`, which hands back an installable debug
APK under the run's **Artifacts**. To try a branch first, run that workflow by
hand on it (**Run workflow**).

## The native layer

It lives in the page, `src/apps/sales/shell/native.ts`, so a fix to it reaches
installed phones the way any change to the page does. Inert in a browser and
in the demo. Back closes a sheet, then a screen, then goes to Today, and only
then puts the app in the background; a strip over the status bar takes the
colour of the screen under it; the bars' last good size stands in until
Android measures them.

## Updates without a store release

The installed app checks the live `https://omni-ware.vercel.app/sales.html`
now and then. When it is a **build of the new app** (it carries the build id
and `<meta name="ow-files">` that `tools/build-app.js` writes), the app fetches
it and every file it names from beside it, keeps them as a new copy on the
phone — all of them or none — and switches to it the next time the app goes to
the background. Any other page is refused, so the app never turns back into the
old one; until the root `sales.html` is the built page (the switch, spec 07
§5), the app stays on what it shipped. A store release is only needed when
something under `android/` changes.

## Notifications

Push needs a Firebase Android app registered for `com.omniware.sales` and its
`google-services.json` placed in `android/app/`. Without it the app builds and
runs; it just doesn't receive push.
