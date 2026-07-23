# Edge Functions — deploy & configure

Both functions need the Supabase CLI logged in and linked to the project (`supabase link`).

## 1. Generate VAPID keys (once)

```
npx web-push generate-vapid-keys
```

Put the **public** key into `VAPID_PUBLIC_KEY` in `index.html` (search for `REPLACE_WITH_GENERATED_VAPID_PUBLIC_KEY`). Keep the **private** key server-side only — never commit it.

## 2. Set secrets

```
supabase secrets set VAPID_PUBLIC_KEY=<public key>
supabase secrets set VAPID_PRIVATE_KEY=<private key>
supabase secrets set VAPID_SUBJECT=mailto:you@yourshop.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every deployed function — no need to set those.

## 2b. Native Android push (FCM) — optional, alongside Web Push

The installed worker APK (see `capacitor.config.json`) uses real native
notifications via Firebase Cloud Messaging instead of Web Push — set this
up too if workers are using the APK rather than a browser-installed PWA.
Both channels work side by side; a shop can have a mix of both.

1. In the [Firebase Console](https://console.firebase.google.com), create a
   project and add an Android app with package name `com.omniware.worker`
   (must match `capacitor.config.json`'s `appId`). Download the generated
   `google-services.json` and place it at `android/app/google-services.json`
   (safe to commit — it's public app config, not a secret, same category as
   the Supabase anon key).
2. Project settings → **Service accounts** tab → "Generate new private key"
   — downloads a service account JSON. This one *is* sensitive (grants
   server-side send authority) — never commit it or paste it into chat.
   Set it directly as a secret:
   ```
   supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat path/to/downloaded-file.json)"
   ```
3. Rebuild the APK (push to `main` — see `.github/workflows/build-worker-apk.yml`)
   so the new `google-services.json` is bundled in.

If `FIREBASE_SERVICE_ACCOUNT_JSON` isn't set, `notify-worker` just skips any
subscriber rows that only have an `fcm_token` (logs why) and keeps sending
Web Push notifications to everyone else normally.

## 3. Deploy

```
supabase functions deploy invite-worker
supabase functions deploy notify-worker
```

## 4. Wire the Database Webhook (Dashboard, one-time)

Database → Webhooks → Create a new webhook:
- Table: `saved_quotes`
- Events: `Update`
- Type: `HTTP Request` → the deployed URL of `notify-worker` (`https://<project-ref>.functions.supabase.co/notify-worker`)
- Method: `POST`, include the default `Authorization: Bearer <anon-or-service-role>` header the Dashboard offers

This single webhook covers every path that can change `assignedWorkerId` — manual assignment, a worker denying (which clears it, triggering no push), and the app's automatic next-order assignment — since they all just update this one table.

`invite-worker` is called directly from the app (`sb.functions.invoke('invite-worker', ...)`) and needs no webhook.
