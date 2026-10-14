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

## Next: notifications

The app is ready for native push. The plan:

1. Add `@capacitor/push-notifications` here.
2. Register an Android app `com.omniware.agent` in the Firebase project that
   the worker app already uses, and add an APNs key for the iPhone.
3. Store each phone's token next to `agent_push_subscriptions`.
4. Have `agent-nudge` send through FCM, the way `notify-worker` does for the
   worker app.
