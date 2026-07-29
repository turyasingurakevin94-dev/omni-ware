# Edge Functions — deploy & configure

Both functions need the Supabase CLI logged in and linked to the project (`supabase link`).

## 1. Native Android push (FCM)

The installed worker APK (see `capacitor.config.json`) uses native
notifications via Firebase Cloud Messaging.

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

If `FIREBASE_SERVICE_ACCOUNT_JSON` isn't set, `notify-worker` just skips the
send and logs why — no error, no crash.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to
every deployed function — no need to set those.

## 2. Deploy

```
supabase functions deploy invite-worker
supabase functions deploy notify-worker
```

## 3. Wire the Database Webhook (Dashboard, one-time)

Database → Webhooks → Create a new webhook:
- Table: `saved_quotes`
- Events: `Update`
- Type: `HTTP Request` → the deployed URL of `notify-worker` (`https://<project-ref>.functions.supabase.co/notify-worker`)
- Method: `POST`, include the default `Authorization: Bearer <anon-or-service-role>` header the Dashboard offers

This single webhook covers every path that can change `assignedWorkerId` — manual assignment, a worker denying (which clears it, triggering no push), and the app's automatic next-order assignment — since they all just update this one table.

`invite-worker` is called directly from the app (`sb.functions.invoke('invite-worker', ...)`) and needs no webhook.

## 4. MTN Mobile Money + Airtel Money (agent payments)

Lets an agent pay for their order from inside the Agent app via a real
MTN/Airtel payment prompt, instead of the shop admin confirming cash by
hand (that manual path, `agentPrepayModal` in index.html, is unchanged
and still works as a fallback). Every shop needs its own real merchant
credentials, entered by a shop owner/admin under Sales Agents → Mobile
Money in index.html — there's nothing to set as an Edge Function secret
for this one, `shop_payment_providers` holds them per-shop.

1. Sign up for a developer account and get a **sandbox** subscription key /
   client credentials first:
   - MTN: https://momodeveloper.mtn.com — subscribe to the "Collections"
     product to get a subscription key. That's the only thing to get from
     MTN's portal — there is no portal page for creating an API user/key
     or setting a callback URL; both only exist as MTN API calls
     (`POST /v1_0/apiuser` with `providerCallbackHost` in the body, then
     `POST /v1_0/apiuser/{id}/apikey`). `mtn-provision-sandbox` (below)
     does this for you from the admin UI — just paste the subscription
     key in and click the button, no manual API calls needed.
   - Airtel: https://developers.airtel.africa — register an app for
     Collections to get a client ID + client secret, and look for a
     "Callback URL" / "Notification URL" field in the app's settings to
     paste `airtel-payment-webhook`'s URL into (exact field name/location
     wasn't verifiable without a live account while building this).
   Production credentials require each provider's merchant KYC/onboarding
   process (a business step, not something this repo can shortcut) —
   develop and test fully against sandbox first.
2. Deploy the five new functions:
   ```
   supabase functions deploy agent-initiate-momo-payment
   supabase functions deploy check-momo-payment-status
   supabase functions deploy mtn-payment-webhook
   supabase functions deploy airtel-payment-webhook
   supabase functions deploy mtn-provision-sandbox
   ```
3. In index.html → Sales Agents → Mobile Money:
   - MTN: paste the subscription key, click "Auto-generate API user + key
     (sandbox)" — this calls MTN's API directly and points
     `providerCallbackHost` at your deployed `mtn-payment-webhook` URL
     automatically. Community reports say MTN's *sandbox* callbacks often
     don't fire at all (no real phone to approve the PIN prompt) —
     `check-momo-payment-status` polling is what actually resolves
     payments either way, so don't rely on the sandbox webhook working.
   - Airtel: paste the client ID/secret you registered, and separately
     register `airtel-payment-webhook`'s URL in the Airtel portal per
     step 1 above.
   - Enable each provider once its credentials are saved.
   Neither provider's exact webhook callback payload shape was verifiable
   without live sandbox access while building this — `mtn-payment-webhook`
   and `airtel-payment-webhook` read the reference id and status
   defensively from the field names each provider's docs describe, but
   **watch the first real callback and adjust the field lookups if
   needed**.
4. Test end to end with a prepay agent order in the Agent app, using
   each provider's sandbox test MSISDNs (MTN and Airtel both publish
   numbers in their sandbox docs that auto-approve or auto-reject, for
   testing both the success and failure paths without a real phone).
