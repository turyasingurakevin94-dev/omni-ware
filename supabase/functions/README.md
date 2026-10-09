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

`notify-worker` sends two pushes. **New order to prepare** goes to the one
worker an order was just put in front of. **Next to pick** goes to every
worker in the shop when an order enters Preparing with nobody on it — it
is in the pickers' queue on each phone, and the next free picker takes it.
The second push exists from the order-tracking rebuild on, and only after
the function is redeployed:
```
supabase functions deploy notify-worker --no-verify-jwt
```
Until then the queue still works — an open worker app polls it once a
minute — but a closed app hears nothing about a new order until somebody
finishes a pick and is handed the next one.

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

Both webhooks are deployed `--no-verify-jwt`, because a provider cannot
present a Supabase JWT. **Neither trusts what it is sent.** A callback is
taken as saying one thing only — *which* payment to look at. The webhook
resolves the reference to a still-pending `agent_mobile_payments` row and
hands off to `check-momo-payment-status` on the service-role key, which
asks the provider's own API with that shop's credentials and applies the
answer. A forged callback can do no more than cause a question we already
had the right to ask.

That is what makes them safe to expose. MTN does not sign its callbacks —
there is no HMAC or signature header in their API — so no signature check
was ever available to make the old "read the status from the body" design
safe. Airtel *does* offer signing; set `AIRTEL_CALLBACK_HMAC_KEY` from the
portal's Security tab for a second lock, which is optional and dormant
while unset.

`applyMomoPaymentToOrder` now exists once, in `check-momo-payment-status`.
It used to exist three times, and one copy missed a fix for weeks.

**Airtel credentials are per shop, in the database — not secrets.**
`agent-initiate-momo-payment` reads them from the `shop_payment_providers`
row for that shop (`provider = 'airtel'`, `enabled = true`), along with the
`environment` that selects sandbox or production. A shop with no enabled row
is refused before any provider is called.

There used to be `AIRTEL_CLIENT_ID` and `AIRTEL_CLIENT_SECRET` secrets,
belonging to the retired `airtel-collection-initiate`. They have been
removed, along with `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` /
`VAPID_SUBJECT` from the retired Web Push delivery. Nothing read any of
them. (`AIRTEL_ENV` was never set at all — the retired function ran on its
`"sandbox"` default, which is why it used the sandbox host.)

Do not reinstate the Airtel pair as a way of configuring Airtel: those
credentials were the ones failing `invalid_client`, and the live path does
not read environment variables for Airtel at all.

The secrets that remain, and what reads them:

| secret | read by |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `notify-worker`, for FCM |
| `NOTIFY_WORKER_SECRET` | `notify-worker`, to authenticate the webhook |
| `AIRTEL_CALLBACK_HMAC_KEY` *(optional, unset)* | `airtel-payment-webhook` |
| `SUPABASE_*` | provided automatically to every function |

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

## 6. Agent notifications (agent-nudge, Web Push)

Agents use `agent.html` in a phone browser, so their notifications are
standard Web Push, not the workers' FCM. Needs migration `0103_agent_push.sql`.

1. Make a VAPID key pair once (any machine with Node):
   ```
   npx web-push generate-vapid-keys
   ```
2. Set the secrets. The private key and the cron secret are sensitive --
   never commit them or paste them into chat:
   ```
   supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." \
     VAPID_SUBJECT="mailto:you@yourshop.com" AGENT_NUDGE_SECRET="<a long random string>"
   ```
3. Deploy (no JWT: the app reads the public key before an agent action, and
   the schedule cannot present one -- the run action is closed by
   `AGENT_NUDGE_SECRET` instead, and refuses to run at all without it):
   ```
   supabase functions deploy agent-nudge --no-verify-jwt
   supabase functions deploy agent-leaderboard
   ```
4. Schedule it hourly: Dashboard -> Integrations -> Cron -> New job ->
   type "Supabase Edge Function", `agent-nudge`, POST, schedule `0 * * * *`,
   body `{"action":"run"}`, header `x-cron-secret: <AGENT_NUDGE_SECRET>`.

It sends nothing before 07:00 or from 20:00 Kampala time, at most three a
day per agent, and each moment once (a request on their catalogue page, an
item the shop pinned, a client who is due, being one good sale from the
next place, a bonus in their cluster ending). To see what it WOULD send
without sending, call it with `{"action":"run","dryRun":true}`.

An agent turns notifications on from the **Alert me** chip on their Feed.
On an iPhone that only works once the app has been added to the Home
Screen (Safari's rule, iOS 16.4+).

## 7. Agents changing an order (agent-change-order)

An agent can change their mind about an order they already sent. Before
they pay, it is theirs: **Edit items** goes back through
`agent-submit-order` with `replaceOrderId` (priced like any order; a line
they did not touch keeps its supplier's yes), and **Cancel order** sets
`agentCancel` for the shop to close from the board. Once paid, or once the
shop has started, they can only **ask** for fewer of a line or none of
anything (`agentChange`); the shop answers each line with ✓ or ✕ in the
order's drawer on Order tracking, and what an agreed line takes off a paid
order becomes `agentCredit`, spent first the next time they pay
(`action: "useCredit"`).

```
supabase functions deploy agent-change-order
supabase functions deploy agent-submit-order
supabase functions deploy agent-initiate-momo-payment
```

It verifies the caller's JWT like every other agent function — no
`config.toml` entry needed — and needs no migration: everything it writes
rides the order's payload.
