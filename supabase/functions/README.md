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

Both providers go through **one** pair of functions. There used to be a
second, Airtel-only pair (`airtel-collection-initiate` /
`airtel-collection-callback`) on its own `airtel_transactions` ledger; no
client ever called it, and it was retired — this README describing it as
"called from the agent app" is most of why it survived as long as it did.

- `agent-initiate-momo-payment` — called from the agent app
  (`sb.functions.invoke('agent-initiate-momo-payment', { shopId, orderId,
  provider, phone }, ...)`), for both MTN and Airtel. `orderId` must be one
  of the calling agent's own orders. The amount is **computed server-side**
  as the order total less `amount_paid` — never taken from the request. A
  second push for the same order inside `PENDING_REUSE_MS` hands back the
  outstanding request rather than raising another. Returns
  `status: "pending"` on success — the agent still has to approve on their
  phone.
- `check-momo-payment-status` — polled by the agent app after initiating.
  This is what actually resolves payments today (see the webhook note
  below), so it is not optional.
- `mtn-payment-webhook` / `airtel-payment-webhook` — where each provider
  posts the final outcome. Both credit the payment and bank it to
  `cash_txns`, and both release the order (`agentPaymentStatus: "paid"`)
  only once the money covers the total; a short payment is still banked.

> **These two webhooks are currently unreachable.** Both are deployed with
> `verify_jwt=true`, so a provider callback gets `401` before the function
> body runs. Payments resolve only via the polling above. Making them
> reachable is a two-step job in this order: set
> `AIRTEL_CALLBACK_HMAC_KEY` (and an equivalent for MTN) so the body is
> authenticated, *then* redeploy with `--no-verify-jwt`. Flipping the flag
> first would let anyone holding a payment reference mark an order paid
> with no money behind it.

**Airtel credentials are per shop, in the database — not secrets.**
`agent-initiate-momo-payment` reads them from the `shop_payment_providers`
row for that shop (`provider = 'airtel'`, `enabled = true`), along with the
`environment` that selects sandbox or production. A shop with no enabled row
is refused before any provider is called.

The `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET` and `AIRTEL_ENV` secrets
belonged to the retired `airtel-collection-initiate` and are now read by
nothing. They can be removed:
```
supabase secrets unset AIRTEL_CLIENT_ID AIRTEL_CLIENT_SECRET AIRTEL_ENV
```
Worth knowing before you do: the four rows left in `airtel_transactions`
were all `invalid_client` from Airtel's OAuth2 endpoint — those env
credentials were being rejected. That says nothing about the credentials in
`shop_payment_providers`, which are a different set entirely and are what
the live path actually uses.

Set the callback URL in the portal's **Security** tab → **Add Callback
URL**, product **Collection-APIs**, event **Transaction**. This must be
`airtel-payment-webhook` — the retired `airtel-collection-callback` read a
different table and would find nothing:
```
https://hgywjaifdmgrcnwxstxg.functions.supabase.co/airtel-payment-webhook
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
supabase functions deploy agent-initiate-momo-payment
supabase functions deploy check-momo-payment-status
supabase functions deploy mtn-payment-webhook
supabase functions deploy airtel-payment-webhook
```

## 4. Wire the Database Webhook (Dashboard, one-time)

Database → Webhooks → Create a new webhook:
- Table: `saved_quotes`
- Events: `Update`
- Type: `HTTP Request` → the deployed URL of `notify-worker` (`https://<project-ref>.functions.supabase.co/notify-worker`)
- Method: `POST`, include the default `Authorization: Bearer <anon-or-service-role>` header the Dashboard offers
- **HTTP Headers**: add `x-webhook-secret` with the value you set below

> `notify-worker` is deployed `verify_jwt=false`, because a Database Webhook
> cannot present a Supabase JWT. That left it accepting a POST from anyone:
> the notification text was built from `record.client_name` in the request
> body, so a crafted request could put arbitrary words on a worker's phone.
>
> Two things changed. The function now re-reads the order from the database
> and builds the notification from that row, so the body only says *which*
> row changed — a forged event is answered with `order not found` before it
> touches anything. That holds with no configuration. The shared secret
> closes the door properly, and is **dormant until you set it**:
>
> ```
> supabase secrets set NOTIFY_WORKER_SECRET="<a long random string>"
> ```
>
> Set it, then add the same value as an `x-webhook-secret` header on the
> webhook above. Until both are in place the function logs a warning on
> every request saying it is open.

This single webhook covers every path that can change `assignedWorkerId` — manual assignment, a worker denying (which clears it, triggering no push), and the app's automatic next-order assignment — since they all just update this one table.

`invite-worker` is called directly from the app (`sb.functions.invoke('invite-worker', ...)`) and needs no webhook.

## 5. MTN Mobile Money + Airtel Money (agent payments)

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
     product to get a **sandbox** subscription key. That's the only thing
     to get from MTN's portal — there is no portal page for creating an
     API user/key or setting a callback URL; both only exist as MTN API
     calls (`POST /v1_0/apiuser` with `providerCallbackHost` in the body,
     then `POST /v1_0/apiuser/{id}/apikey`). `mtn-provision-apiuser`
     (below) does this for you from the admin UI — just paste the
     subscription key in, pick the environment, and click the button, no
     manual API calls needed. **Going live**: production access is a
     separate MTN business process — you (or the shop) must already be,
     or become, an approved MTN Mobile Money merchant in Uganda (business
     registration + KYC with MTN's merchant services team, not just a
     developer-portal signup). Once approved, MTN's momodeveloper.mtn.com
     "Go Live" flow issues a **production** subscription key for the
     Collections product; paste that in, switch Environment to
     Production, and click "Auto-generate API user + key" again — it'll
     attempt the same self-provisioning flow against MTN's live host.
     This has not been verified against a real MTN merchant account; if
     MTN's production process turns out to issue the API user/key
     directly instead, just paste them into the API user / API key
     fields by hand — the payment code already branches correctly on
     `environment` either way.
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
   supabase functions deploy mtn-provision-apiuser
   ```
3. In index.html → Sales Agents → Mobile Money:
   - MTN: paste the subscription key, click "Auto-generate API user + key
     (sandbox/production, matching the Environment selector above)" —
     this calls MTN's API directly and points `providerCallbackHost` at
     your deployed `mtn-payment-webhook` URL automatically. Community
     reports say MTN's *sandbox* callbacks often don't fire at all (no
     real phone to approve the PIN prompt) — `check-momo-payment-status`
     polling is what actually resolves payments either way, so don't rely
     on the sandbox webhook working.
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
