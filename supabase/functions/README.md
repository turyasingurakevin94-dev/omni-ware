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

1. Sign up for a developer account and get **sandbox** credentials first:
   - MTN: https://momodeveloper.mtn.com — subscribe to the "Collections"
     product to get a subscription key, then create an API user + API key
     against the sandbox.
   - Airtel: https://developers.airtel.africa — register an app for
     Collections to get a client ID + client secret.
   Production credentials require each provider's merchant KYC/onboarding
   process (a business step, not something this repo can shortcut) —
   develop and test fully against sandbox first.
2. Deploy the four new functions:
   ```
   supabase functions deploy agent-initiate-momo-payment
   supabase functions deploy check-momo-payment-status
   supabase functions deploy mtn-payment-webhook
   supabase functions deploy airtel-payment-webhook
   ```
3. Register the webhook URLs in each provider's developer portal (their
   equivalent of step 3 above, but provider-side rather than a Supabase
   Database Webhook — these two functions are public HTTP endpoints the
   telco calls directly):
   - MTN: set the sandbox subscription's callback host to
     `https://<project-ref>.functions.supabase.co/mtn-payment-webhook`.
   - Airtel: set the app's callback URL to
     `https://<project-ref>.functions.supabase.co/airtel-payment-webhook`.
   Neither provider's exact callback payload shape was verifiable without
   a live sandbox account while building this — `mtn-payment-webhook`
   and `airtel-payment-webhook` read the reference id and status
   defensively from the field names each provider's docs describe, but
   **watch the first real sandbox callback and adjust the field lookups
   if needed**. `check-momo-payment-status` (polled from the Agent app,
   and from a "Re-check" button in the admin ledger) works independently
   of the webhooks ever arriving correctly, so payments still resolve
   even before this is nailed down.
4. In index.html → Sales Agents → Mobile Money, enter each provider's
   sandbox credentials, environment set to "Sandbox", and enable it.
5. Test end to end with a prepay agent order in the Agent app, using
   each provider's sandbox test MSISDNs (MTN and Airtel both publish
   numbers in their sandbox docs that auto-approve or auto-reject, for
   testing both the success and failure paths without a real phone).
