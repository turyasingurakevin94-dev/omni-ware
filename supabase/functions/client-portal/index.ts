// The ONLY way a customer's browser learns anything about this shop.
//
// A customer is a THIRD IDENTITY (0096). They are not shop_members, they
// are not agents, and they are deliberately not auth.users rows either —
// so they have no row-level access to anything at all. Everything they
// see is read here with the service-role key and hand-picked, field by
// field, into a response. There is no column-level redaction to get
// subtly wrong because there is no column-level access.
//
// WHAT MUST NEVER CROSS THIS BOUNDARY, and it is stricter than
// agent-catalog's because a customer is further out than an agent:
//
//   · supplier identity — suppliers.name, suppliers.id, prices.supplier_id,
//     prices.supplier_sku. This is the bypass vector and the one leak
//     that cannot be taken back.
//   · cost — prices.wholesale, prices.retail, price_source, and the
//     `price` field on a saved_quotes line, which is what the shop PAID.
//   · any markup rule, margin or discount percentage.
//   · rival_prices. That record is an argument for what this shop
//     charges; in a customer's hands it is a shopping list.
//   · any other customer. Not their price, not their debt, not their
//     existence.
//   · sourcing_leads.candidates, which carry importer and supplier names
//     by design.
//
// The rule the tests enforce is simpler than the list: a row read from
// products, prices, suppliers or saved_quotes is NEVER spread into a
// response. Every response object is built literally, key by key.
//
// The pricing helpers this function will grow are duplicated verbatim
// from agent-catalog rather than imported — Edge Functions here are
// deployed by pasting one file at a time into the Supabase dashboard,
// which has no way to pull in a second file, so a shared-module import
// would silently fail to deploy. That is the house pattern; see
// agent-catalog's own header for why it is not a mistake.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

// ---------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------

// The last nine digits, and nothing else. 0772418903, +256772418903,
// 256 772 418 903 and 0772-418-903 are one person, and a portal that
// treats them as four is a portal that cannot find anybody's orders.
// Matches nothing about country codes deliberately: this shop's
// customers are all on the same one, and a rule that tries to parse
// them is a rule that mis-parses one.
export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

// Four figures, from the platform's own CSPRNG. Never Math.random: a PIN
// that can be predicted from the clock is not a PIN.
function mintPin(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 10000).padStart(4, "0");
}

function mintToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

// PBKDF2 rather than a bare digest, because a four-figure PIN is a
// ten-thousand-item search space and a plain SHA-256 of it is a lookup
// table somebody has already built. 100k iterations turns a leaked
// database from "here is every customer's live PIN" into an attack that
// costs real time for a secret that expires in ten minutes anyway.
//
// The salt is the account, not a column: one PIN per account at a time,
// so there is nothing to carry and nothing to forget to write.
async function hashPin(pin: string, shopId: string, customerId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(`${shopId}:${customerId}`), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
}

// Constant time. A comparison that returns early on the first wrong
// character leaks how much of a secret was right, one request at a time.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const PIN_TTL_MS = 10 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 3;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// One request per phone per minute, and a ceiling per shop per hour.
// The first stops somebody hammering a number; the second stops a script
// walking through them. Same reasoning as catalogue-public, which is the
// only other endpoint here that a stranger can reach.
const START_WINDOW_MS = 60 * 1000;
const START_SHOP_WINDOW_MS = 60 * 60 * 1000;
const START_SHOP_MAX = 40;

// ---------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------

// What a saved order came to, from the lines the customer was shown.
// sellPrice is OUR price to THEM. `price` on the same line is what the
// shop paid the supplier, and it is never read here — not to total, not
// to check, not at all.
export function orderTotal(payload: any): number {
  const items = payload && payload.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce(function (sum, it) {
    const qty = Number(it && it.qty) || 0;
    const sell = Number(it && it.sellPrice) || 0;
    return sum + qty * sell;
  }, 0);
}

// Oldest unpaid day, from the debt log rather than from a stored age.
// A stamped age is wrong by one every midnight.
export function oldestDays(rows: any[], today: string): number | null {
  const asAt = Date.parse(today + "T00:00:00Z");
  const days = (rows || [])
    .map(function (r) { return r && r.date; })
    .filter(function (d) { return typeof d === "string" && d.length >= 10; })
    .map(function (d) { return Math.round((asAt - Date.parse(d.slice(0, 10) + "T00:00:00Z")) / 86400000); })
    .filter(function (n) { return Number.isFinite(n) && n >= 0; });
  return days.length ? Math.max(...days) : null;
}

// ---------------------------------------------------------------------

async function sessionAccount(shopId: string, token: string) {
  if (!token) return null;
  const { data } = await admin
    .from("client_sessions")
    .select("shop_id, customer_id, expires_at, revoked_at")
    .eq("shop_id", shopId)
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const shopId = String(body.shopId ?? "");
  const action = String(body.action ?? "");
  if (!shopId || !action) return json({ error: "shopId and action are required" }, 400);

  try {
    // -----------------------------------------------------------------
    // start — ask for a PIN
    //
    // Says the same thing whether or not the number has an account. A
    // portal that answers "no account on that number" is a portal that
    // will tell a stranger which of your customers are on it.
    // -----------------------------------------------------------------
    if (action === "start") {
      const phone = normalisePhone(body.phone);
      if (!phone) return json({ error: "Enter the phone number you use with the shop" }, 400);

      const { count: shopRecent } = await admin
        .from("client_accounts")
        .select("customer_id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .gte("pin_expires_at", new Date(Date.now() - START_SHOP_WINDOW_MS).toISOString());
      if ((shopRecent || 0) >= START_SHOP_MAX) {
        return json({ error: "Too many sign-ins just now. Try again shortly." }, 429);
      }

      const { data: account } = await admin
        .from("client_accounts")
        .select("customer_id, status, pin_expires_at")
        .eq("shop_id", shopId).eq("phone", phone).maybeSingle();

      // Nothing below changes the shape of the reply. Not found, suspended
      // and asking twice in a minute all look identical from outside.
      if (account && account.status === "active") {
        const askedRecently = account.pin_expires_at
          && Date.parse(account.pin_expires_at) > Date.now() - PIN_TTL_MS + START_WINDOW_MS;
        if (!askedRecently) {
          const pin = mintPin();
          await admin.from("client_accounts").update({
            pin_hash: await hashPin(pin, shopId, account.customer_id),
            pin_expires_at: new Date(Date.now() + PIN_TTL_MS).toISOString(),
            pin_attempts: 0,
          }).eq("shop_id", shopId).eq("customer_id", account.customer_id);
        }
      }
      // DELIVERY IS NOT WIRED, and this says so rather than pretending.
      // wa-send requires a staff session (is_shop_member), which a customer
      // asking for a PIN does not have, so a WhatsApp send from here means
      // talking to Meta directly with the shop's own token — a real
      // integration, not a guess. Until it exists the shop reads the PIN
      // off the admin screen and gives it to the customer, which is how a
      // shop with twenty trade customers would onboard them anyway.
      return json({ ok: true, delivery: "shop", expiresInSeconds: PIN_TTL_MS / 1000 });
    }

    // -----------------------------------------------------------------
    // verify — PIN for a session
    // -----------------------------------------------------------------
    if (action === "verify") {
      const phone = normalisePhone(body.phone);
      const pin = String(body.pin ?? "").trim();
      const deviceId = String(body.deviceId ?? "").trim().slice(0, 120);
      if (!phone || !/^\d{4}$/.test(pin) || !deviceId) {
        return json({ error: "Enter the four figures we gave you" }, 400);
      }

      const { data: account } = await admin
        .from("client_accounts")
        .select("customer_id, pin_hash, pin_expires_at, pin_attempts, status")
        .eq("shop_id", shopId).eq("phone", phone).maybeSingle();

      const wrong = { error: "That PIN is not right", triesLeft: 0 };
      if (!account || account.status !== "active" || !account.pin_hash) return json(wrong, 401);
      if (!account.pin_expires_at || Date.parse(account.pin_expires_at) <= Date.now()) {
        return json({ error: "That PIN has run out. Ask for another." }, 401);
      }
      if ((account.pin_attempts || 0) >= PIN_MAX_ATTEMPTS) {
        return json({ error: "Too many tries. Ask for a new PIN." }, 429);
      }

      const ok = safeEqual(account.pin_hash, await hashPin(pin, shopId, account.customer_id));
      if (!ok) {
        const attempts = (account.pin_attempts || 0) + 1;
        await admin.from("client_accounts").update({ pin_attempts: attempts })
          .eq("shop_id", shopId).eq("customer_id", account.customer_id);
        return json({ error: "That PIN is not right", triesLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts) }, 401);
      }

      // Spent on use. A PIN that still works after it has been used is a
      // PIN that works for whoever reads the message next.
      await admin.from("client_accounts").update({
        pin_hash: null, pin_expires_at: null, pin_attempts: 0,
        last_seen_at: new Date().toISOString(),
      }).eq("shop_id", shopId).eq("customer_id", account.customer_id);

      const token = mintToken();
      await admin.from("client_sessions").insert({
        shop_id: shopId,
        customer_id: account.customer_id,
        token_hash: await sha256Hex(token),
        device_id: deviceId,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });

      const { data: customer } = await admin
        .from("customers").select("name").eq("shop_id", shopId).eq("id", account.customer_id).maybeSingle();
      return json({ ok: true, token, name: customer?.name || "" });
    }

    // -----------------------------------------------------------------
    // account — what you owe, on what terms, and what you last bought
    // -----------------------------------------------------------------
    if (action === "account") {
      const session = await sessionAccount(shopId, String(body.token ?? ""));
      if (!session) return json({ error: "Sign in again" }, 401);
      const customerId = session.customer_id;

      const [{ data: customer }, { data: debtRows }, { data: quotes }] = await Promise.all([
        admin.from("customers")
          .select("name, phone, debt, terms_days, credit_limit")
          .eq("shop_id", shopId).eq("id", customerId).maybeSingle(),
        admin.from("customer_debt_log")
          .select("date, type, amount").eq("shop_id", shopId).eq("customer_id", customerId),
        admin.from("saved_quotes")
          .select("id, client_name, client_phone, date, status, invoiced, voided, amount_paid, payload")
          .eq("shop_id", shopId).eq("status", "order").eq("voided", false)
          .order("id", { ascending: false }).limit(60),
      ]);
      if (!customer) return json({ error: "Sign in again" }, 401);

      const mine = normalisePhone(customer.phone);
      // Matched on the NORMALISED phone, never on the name. saved_quotes
      // carries client_name and client_phone as text and no customer id
      // (0001), so a name match would hand "Nakato Grace" the orders of
      // "nakato grace ltd". A number is the only thing on that row that
      // means one person.
      const orders = (quotes || [])
        .filter((q) => mine && normalisePhone(q.client_phone) === mine)
        .slice(0, 5)
        .map((q) => ({
          id: q.id,
          date: q.date,
          items: Array.isArray((q.payload as { items?: unknown[] })?.items)
            ? (q.payload as { items: unknown[] }).items.length : 0,
          total: orderTotal(q.payload),
          invoiced: !!q.invoiced,
        }));

      const debt = Number(customer.debt) || 0;
      const limit = customer.credit_limit == null ? null : Number(customer.credit_limit);
      const charges = (debtRows || []).filter((r) => Number(r.amount) > 0);

      // Built key by key. Nothing from customers, saved_quotes or the debt
      // log is spread, so a column added to any of them tomorrow cannot
      // arrive here by accident.
      return json({
        ok: true,
        account: {
          name: customer.name || "",
          owed: debt,
          // Null where nobody has said. 0096 refuses to default these and
          // so does this: a terms line the shop never agreed is worse on
          // a customer's screen than no terms line at all.
          termsDays: customer.terms_days == null ? null : Number(customer.terms_days),
          creditLimit: limit,
          available: limit == null ? null : Math.max(0, limit - debt),
          oldestDays: debt > 0 ? oldestDays(charges, new Date().toISOString().slice(0, 10)) : null,
          orderCount: (quotes || []).filter((q) => mine && normalisePhone(q.client_phone) === mine).length,
        },
        orders,
      });
    }

    if (action === "signout") {
      const token = String(body.token ?? "");
      if (token) {
        await admin.from("client_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("shop_id", shopId).eq("token_hash", await sha256Hex(token));
      }
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("client-portal: uncaught", err);
    return json({ error: String((err as Error)?.message || err), stage: "uncaught" }, 500);
  }
});
