# Omni-Ware Agent — the phone app

The agent app for Android and iPhone. It is `agent.html` (the same page the
browser gets) inside a native shell built with Capacitor 8, so there is one
app to maintain, not three.

## Why it is fast and light

- **Everything it needs to start is inside the app.** The page, the Supabase
  client and the fonts ship in the install, so it opens without waiting on a
  CDN, even on one bar of signal. The web page loads the same things from
  CDNs; `src/transform.js` swaps them at build time.
- **About 5 MB installed**, with no framework, just the one page.
- **Back on Android** closes the top sheet, then returns to Today, then puts
  the app in the background (not closed), so it reopens instantly.

## Updates without a store release

A change to `agent.html` reaches installed apps on its own:

1. While open, the app checks `https://omni-ware.vercel.app/agent.html` at
   most every 30 minutes. An unchanged page costs a few bytes (ETag).
2. A new page is saved on the phone next to the app's own files.
3. The app switches to it the next time it goes to the background, never in
   the middle of an order.

That includes the app's own native layer (back button, status bar, these
updates). It is inside `agent.html`, not a separate file, so fixing it
reaches phones the same way.

A **store release** is needed only when the native side changes: anything
under `android/` or `ios/`, a new Capacitor plugin, or the app icon.
Installing a newer store version replaces any saved page.

## Build

```sh
cd apps/agent
npm ci
npm run build          # www/ from ../../agent.html (never edit www/ by hand)
npx cap sync           # copies www/ into android/ and ios/
```

- **Android:** open `android/` in Android Studio, or `cd android && ./gradlew assembleDebug`.
- **iPhone (Mac only):** open `ios/App/App.xcodeproj` in Xcode.

Every push to `main` that touches `agent.html` or `apps/agent/` is built by
`.github/workflows/build-agent-app.yml`:

- **Android** produces an installable debug APK. It is under the run's
  **Artifacts** in the GitHub Actions tab.
- **iPhone** builds for the simulator, which proves the project compiles.

## Getting it onto phones

**Android**

- **Testing now:** download the APK from the latest workflow run and open it
  on the phone. Allow "install unknown apps" when asked.
- **Play Store:** you need a Google Play Console account (US $25, once) and
  a release signing key. Build with `./gradlew bundleRelease` and upload the
  `.aab`. App id: `com.omniware.agent`.

**iPhone**

Apple does not allow installing apps outside its own channels. You need the
Apple Developer Program (US $99 a year), then:

- **TestFlight:** up to 10,000 testers, by invite link. This is the quickest
  way to put it on agents' iPhones.
- **App Store:** a public listing.

On a Mac: open the project in Xcode, choose your Team under Signing, then
Product → Archive → Distribute. Signing can later be moved into the GitHub
workflow, with the certificate stored as a secret.

## Notifications

Built in (`@capacitor/push-notifications`): the app asks once after an
agent's first order is sent, saves the phone's token in
`agent_push_subscriptions`, and `agent-nudge` sends to it -- FCM on
Android, APNs on iPhone. A tap opens the goal, order, client or item it is
about. Setup, once:

1. **Android:** in the worker app's Firebase project add an Android app
   `com.omniware.agent`, download `google-services.json` to
   `android/app/google-services.json` and commit it. The build picks it up
   by itself; without it, the app runs but cannot turn notifications on.
2. **iPhone:** an APNs key from the Apple Developer account, set as
   Supabase secrets, and the Push Notifications capability on the App ID.
   The app already carries the entitlement (`ios/App/App/App.entitlements`).
3. Run migration `0110_agent_native_push.sql` and redeploy `agent-nudge`
   and `agent-catalog`.

The steps and secret names are in `supabase/functions/README.md`,
section 6.
