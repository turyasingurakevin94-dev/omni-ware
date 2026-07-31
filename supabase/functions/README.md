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

## 2. Airtel Money Collection (USSD Push)

Two functions cover the full round trip:

This is for **agents settling what they owe the shop** for their own orders
(the same money flow `promptAgentPrepayment()`/`agentPrepayConfirm` already
handle manually in `index.html` by flipping `agentPaymentStatus` once staff
confirm cash received) — not a general customer-facing checkout. It's meant
to be called from the standalone Agent app, authenticated as the agent
(agents are deliberately not `shop_members`, see `0012_sales_agents.sql`).

- `airtel-collection-initiate` — called from the agent app
  (`sb.functions.invoke('airtel-collection-initiate', { shopId, quoteId,
  msisdn?, amount?, reference? }, ...)`). `quoteId` must be one of the
  calling agent's own orders; `msisdn` defaults to the agent's own phone on
  file and `amount` defaults to the order's full outstanding balance if not
  given. Fetches an OAuth2 token, creates the `airtel_transactions` ledger
  row (see `0016_airtel_transactions.sql`), then sends the USSD Push
  request. Always returns `status: "pending"` on success — the agent still
  has to approve on their phone.
- `airtel-collection-callback` — Airtel posts the final outcome here. Only
  updates the matching `airtel_transactions` row and, if the paid amount
  covers what's owed, sets that order's `agentPaymentStatus` to `"paid"`.

Required secrets (from the app's **Keys** section in the Airtel Developer
Portal — never commit these):
```
supabase secrets set AIRTEL_CLIENT_ID="<client_id>"
supabase secrets set AIRTEL_CLIENT_SECRET="<client_secret>"
```
`AIRTEL_ENV` defaults to `sandbox` (uses the `/simulate/...` paths the
Postman collection showed). Set it to `production` only once the app has
gone live in the portal:
```
supabase secrets set AIRTEL_ENV="production"
```

Once `airtel-collection-callback` is deployed, set its URL in the portal's
**Security** tab → **Add Callback URL**, product **Collection-APIs**, event
**Transaction**:
```
https://hgywjaifdmgrcnwxstxg.functions.supabase.co/airtel-collection-callback
```
If you turn on **Callback Authentication** there, copy the private key it
shows you and set it as a secret; leave it unset while that toggle is off:
```
supabase secrets set AIRTEL_CALLBACK_HMAC_KEY="<key from the portal>"
```

## 3. Deploy

```
supabase functions deploy invite-worker
supabase functions deploy notify-worker
supabase functions deploy airtel-collection-initiate
supabase functions deploy airtel-collection-callback
```

## 4. Wire the Database Webhook (Dashboard, one-time)

Database → Webhooks → Create a new webhook:
- Table: `saved_quotes`
- Events: `Update`
- Type: `HTTP Request` → the deployed URL of `notify-worker` (`https://<project-ref>.functions.supabase.co/notify-worker`)
- Method: `POST`, include the default `Authorization: Bearer <anon-or-service-role>` header the Dashboard offers

This single webhook covers every path that can change `assignedWorkerId` — manual assignment, a worker denying (which clears it, triggering no push), and the app's automatic next-order assignment — since they all just update this one table.

`invite-worker` is called directly from the app (`sb.functions.invoke('invite-worker', ...)`) and needs no webhook.
