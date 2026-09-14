// A customer's own order, priced by the shop.
//
// THE WHOLE POINT OF THIS FILE: the browser sends quantities and NOTHING
// ELSE. No price, no total, not even a figure to check against. Every line
// is priced here, server-side, from live data, by the same functions
// client-portal used to show the price — so what the customer is charged
// and what they were shown are the same number for the same reason, and a
// tampered request has nothing to tamper with.
//
// agent-submit-order makes the same argument for agents and states it
// well: RLS controls which ROWS a caller may touch, never whether the
// VALUES inside them are honest. A customer is further out still — they
// have no Supabase identity at all — so there is no insert path to
// harden, only this one.
//
// The response carries back the lines as priced. The page compares them
// against the basket it was showing and tells the customer if anything
// moved. That comparison is deliberately NOT done here: doing it would
// mean accepting the customer's idea of a price, and a figure this
// function has no use for is a figure some later edit can find a use for.
//
// The shop-facing side is built to look exactly like an order a member of
// staff took at the counter. client_name and client_phone are the
// CUSTOMER'S (not an agent's — that indirection exists for agents because
// of agent_clients, and there is nothing like it here), items[].price is
// real supplier cost, items[].sellPrice is what the shop is owed, and
// supplierId rides each line — so every admin-side screen, every profit
// figure and the purchase-invoice generator all treat this order correctly
// with no special-casing. payload.originPortal is the only thing that
// marks it, and it marks it for the shop's eyes, not for its logic.
//
// The identity and pricing helpers below are duplicated VERBATIM from
// client-portal, which is the house pattern: Edge Functions here deploy
// one file at a time through the dashboard, so a shared import would fail
// to deploy. test/client-submit-order.test.js compares the copies
// character for character. If either changes, change both.
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

// A basket has to be small enough to be a basket. 60 lines is more than
// any counter order this shop has ever taken, and a cap is what stops one
// request asking the shop to price ten thousand items.
const MAX_LINES = 60;
const MAX_QTY = 100000;
// How long two identical baskets are treated as one submission. A send
// that lands while the handset's connection drops looks like a failure:
// the page re-enables its button, the customer taps again, and the shop
// gets two identical orders to prepare and invoice. Same reasoning, and
// the same window, as agent-submit-order.
const SUBMIT_DEDUPE_MS = 90 * 1000;

// The same basket described the same way, whatever order the lines happen
// to sit in. Built only from what the CUSTOMER chose — product, variant,
// quantity. Everything else on a stored line is derived here and would
// legitimately differ between two runs if a price moved in between, which
// must not stop a genuine re-send being recognised as one.
function basketFingerprint(items: any): string {
  return (Array.isArray(items) ? items : [])
    .map((it: any) => [
      String(it?.productId ?? ""),
      String(it?.variantIdx ?? ""),
      String(Number(it?.qty) || 0),
    ].join("|"))
    .sort()
    .join(";");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Duplicated verbatim from client-portal. See the header.
// ---------------------------------------------------------------------

type MarkupKind = "wholesale" | "retail";
type MarkupRule = { type: string; value: number } | null;

function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

function effectiveMarkupRule(product: any, variantIdx: number | null, kind: MarkupKind, dflt: any = null): MarkupRule {
  if (variantIdx != null && Array.isArray(product.variants) && product.variants[variantIdx]) {
    const v = product.variants[variantIdx];
    const vVal = Number(v[kind + "MarkupValue"]) || 0;
    if (vVal > 0) return { type: v[kind + "MarkupType"], value: vVal };
  }
  const colVal = Number(product[kind + "_markup_value"]) || 0;
  if (colVal > 0) return { type: product[kind + "_markup_type"], value: colVal };
  // The shop default rule (app_settings.presets.defaultMarkup), threaded in
  // as an ARGUMENT per request -- never module state; requests interleave in
  // one isolate. Mirrors the last step of index.html's effectiveMarkupRule.
  const dVal = dflt ? Number(dflt[kind + "Value"]) || 0 : 0;
  if (dVal > 0) return { type: dflt[kind + "Type"] === "fixed" ? "fixed" : "percent", value: dVal };
  return null;
}

function suggestedSellingPrice(product: any, basePrice: number | null, kind: MarkupKind, variantIdx: number | null, packQty = 0, dflt: any = null): number | null {
  if (basePrice == null) return null;
  const rule = effectiveMarkupRule(product, variantIdx, kind, dflt);
  if (!rule) return null;
  if (rule.type === "fixed") {
    const fixedPerUnit = (kind === "wholesale" && packQty > 0) ? rule.value / packQty : rule.value;
    return basePrice + fixedPerUnit;
  }
  return basePrice * (1 + rule.value / 100);
}

function tieredUnitPrice(row: any, qty: number, kind: MarkupKind): number | null {
  const base = row[kind];
  if (base == null) return null;
  const packQty = Number(row.pack_qty) || 0;
  const tiers = (Array.isArray(row.tiers) ? row.tiers : []).filter((t: any) =>
    kind === "wholesale" ? (packQty > 0 && t.minQty >= packQty) : (packQty === 0 || t.minQty < packQty)
  );
  if (!tiers.length) return Number(base);
  let best = Number(base), bestMinQty = 0;
  tiers.forEach((t: any) => {
    if (t.price != null && qty >= t.minQty && t.minQty >= bestMinQty) { best = Number(t.price); bestMinQty = t.minQty; }
  });
  return best;
}

function pickBestPriceRow(rows: any[]): any | null {
  const priced = rows.filter((r) => !r.out_of_stock);
  if (!priced.length) return null;
  return priced.slice().sort((a, b) => {
    const aw = a.wholesale != null ? a.wholesale : Infinity;
    const bw = b.wholesale != null ? b.wholesale : Infinity;
    if (aw !== bw) return aw - bw;
    const ar = a.retail != null ? a.retail : Infinity;
    const br = b.retail != null ? b.retail : Infinity;
    return ar - br;
  })[0];
}

function rememberedPrices(quotes: any[], mine: string): Record<string, { price: number; at: string }> {
  const out: Record<string, { price: number; at: string }> = {};
  if (!mine) return out;
  (quotes || []).forEach(function (q) {
    if (q.voided) return;
    if (normalisePhone(q.client_phone) !== mine) return;
    const items = q.payload && q.payload.items;
    if (!Array.isArray(items)) return;
    const at = String(q.date || "");
    items.forEach(function (it: any) {
      if (!it || !it.productId) return;
      const sell = Number(it.sellPrice);
      if (!(sell > 0)) return;
      const key = it.productId + "::" + (it.variantIdx == null ? "" : String(it.variantIdx));
      // >= so that among orders on the same day the later one in the list
      // wins, rather than whichever happened to be walked first.
      if (!out[key] || at >= out[key].at) out[key] = { price: sell, at };
    });
  });
  return out;
}

function customerUnitPrice(product: any, row: any, qty: number, dflt: any, held: { price: number; at: string } | null) {
  if (!row) return null;
  const packQty = Number(row.pack_qty) || 0;
  const kind: MarkupKind = packQty > 0 && qty >= packQty ? "wholesale" : "retail";
  const variantIdx = row.variant_idx == null || row.variant_idx === "" ? null : Number(row.variant_idx);
  const cost = tieredUnitPrice(row, qty, kind);
  if (cost == null) return null;
  // A product with no markup rule anywhere prices at cost, exactly as it
  // does for an agent: a shop that has not said what it makes on an item
  // has not said what it charges for it either.
  const today = suggestedSellingPrice(product, cost, kind, variantIdx, packQty, dflt) ?? cost;
  const holds = !!held && held.price >= cost && held.price <= today;
  return {
    unitPrice: holds ? held!.price : today,
    heldFrom: holds ? held!.at : null,
    cost,
    unit: row.unit || "",
    packUnit: row.pack_unit || "",
    packQty,
  };
}

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
  const items = Array.isArray(body.items) ? body.items : [];
  if (!shopId) return json({ error: "shopId is required" }, 400);
  if (!items.length) return json({ error: "There is nothing in the basket" }, 400);
  if (items.length > MAX_LINES) return json({ error: `An order can carry ${MAX_LINES} lines. Ring the shop for anything bigger.` }, 400);
  for (const it of items) {
    const qty = Number((it as any)?.qty);
    if (!(it as any)?.productId || !(qty > 0) || qty > MAX_QTY) {
      return json({ error: "Every line needs an item and a quantity" }, 400);
    }
  }

  try {
    const session = await sessionAccount(shopId, String(body.token ?? ""));
    if (!session) return json({ error: "Sign in again" }, 401);
    const customerId = session.customer_id;

    const { data: account } = await admin.from("client_accounts")
      .select("status").eq("shop_id", shopId).eq("customer_id", customerId).maybeSingle();
    // A suspended account keeps its history and loses its counter. The
    // session is revoked when a shop suspends somebody, so this is the
    // belt to that braces — a token minted before the suspension must not
    // be able to place an order after it.
    if (!account || account.status !== "active") {
      return json({ error: "This account cannot place orders. Ring the shop." }, 403);
    }

    const { data: customer } = await admin.from("customers")
      .select("id, name, phone").eq("shop_id", shopId).eq("id", customerId).maybeSingle();
    if (!customer) return json({ error: "Sign in again" }, 401);
    const mine = normalisePhone(customer.phone);

    // Same basket, same customer, a moment ago: hand back the order that
    // already exists rather than making the shop prepare it twice.
    const fingerprint = basketFingerprint(items);
    const cutoff = new Date(Date.now() - SUBMIT_DEDUPE_MS).toISOString();
    const { data: recent } = await admin.from("saved_quotes")
      .select("id, payload").eq("shop_id", shopId).eq("voided", false)
      .gte("payload->>savedAt", cutoff);
    const already = (recent || []).find((q: any) =>
      q.payload?.customerId === customerId && basketFingerprint(q.payload?.items) === fingerprint);
    if (already) return json({ ok: true, orderId: already.id, duplicate: true, lines: [], total: 0 });

    const productIds = [...new Set(items.map((it: any) => String(it.productId)))];
    const PRICE_COLS = "product_id, variant_idx, supplier_id, wholesale, retail, pack_qty, unit, pack_unit, tiers, out_of_stock";
    const [{ data: settingsRow }, { data: products }, { data: priceRows }, { data: quotes }] = await Promise.all([
      admin.from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle(),
      admin.from("products").select("id, name, variants, wholesale_markup_type, wholesale_markup_value, retail_markup_type, retail_markup_value")
        .eq("shop_id", shopId).in("id", productIds),
      // supplier_id IS read here, unlike in client-portal — it goes onto
      // the stored line so the shop knows where to buy, exactly as a
      // staff-built quote carries it. It is never part of a response; the
      // test pins that.
      admin.from("prices").select(PRICE_COLS).eq("shop_id", shopId).in("product_id", productIds),
      admin.from("saved_quotes").select("client_phone, date, voided, payload")
        .eq("shop_id", shopId).eq("voided", false)
        .order("id", { ascending: false }).limit(200),
    ]);
    const presets = settingsRow?.presets || {};
    const defaultMarkup = presets.defaultMarkup || null;
    // THE SAME remembered prices client-portal computed to show the
    // figure. If these two ever disagreed, the customer would be charged
    // a number they were never shown.
    const held = rememberedPrices(quotes || [], mine);
    const productsById = new Map<string, any>((products || []).map((p: any) => [p.id, p]));

    const rowsByKey = new Map<string, any[]>();
    (priceRows || []).forEach((r: any) => {
      const k = `${r.product_id}::${r.variant_idx == null ? "" : r.variant_idx}`;
      if (!rowsByKey.has(k)) rowsByKey.set(k, []);
      rowsByKey.get(k)!.push(r);
    });

    const lineItems: any[] = [];
    const reply: any[] = [];
    for (const it of items as any[]) {
      const productId = String(it.productId);
      const variantIdx = it.variantIdx == null || it.variantIdx === "" ? null : Number(it.variantIdx);
      const qty = Number(it.qty);
      const product = productsById.get(productId);
      if (!product) return json({ error: "We no longer have one of those items. Take it out and send again.", productId }, 409);

      const key = `${productId}::${variantIdx == null ? "" : variantIdx}`;
      // pickBestPriceRow, not quotableRow: an order is CHARGED, and an
      // out-of-stock row is not something to promise against. A basket
      // that has gone out of stock since it was filled comes back as a
      // refusal naming the line, not as an order the shop cannot fill.
      const row = pickBestPriceRow(rowsByKey.get(key) || []);
      const priced = row ? customerUnitPrice(product, row, qty, defaultMarkup, held[key] || null) : null;
      if (!priced) {
        return json({
          error: `We cannot price ${product.name} just now. Take it out and send the rest, or ring the shop.`,
          productId, variantIdx,
        }, 409);
      }

      const variant = variantIdx != null && Array.isArray(product.variants) ? product.variants[variantIdx] : null;
      lineItems.push({
        productId,
        productName: product.name,
        variantIdx,
        variantLabel: variant ? Object.values(variant.combo || {}).join(" / ") : "",
        qty,
        unit: priced.unit,
        packUnit: priced.packUnit,
        packQty: priced.packQty,
        supplierId: row.supplier_id,
        price: priced.cost,          // what the shop pays — never sent back
        sellPrice: priced.unitPrice, // what the shop is owed for this line
      });
      // Built separately and key by key. The stored line and the reply are
      // two different objects on purpose: one carries cost and a supplier,
      // the other cannot.
      reply.push({
        productId, variantIdx, qty,
        name: product.name,
        unit: priced.unit,
        unitPrice: priced.unitPrice,
        heldFrom: priced.heldFrom,
      });
    }

    const total = lineItems.reduce((s, l) => s + l.qty * l.sellPrice, 0);
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await admin.from("saved_quotes").insert({
      shop_id: shopId,
      client_name: customer.name,
      client_phone: customer.phone,
      date: todayISO(),
      // Step 1 on the shop's own board — "Taken". The same status an agent
      // order lands at, and the same one a member of staff would leave a
      // counter order at. A portal order is not a lesser kind of order.
      status: "draft",
      invoiced: false,
      voided: false,
      amount_paid: 0,
      payload: {
        client: { name: customer.name, phone: customer.phone },
        items: lineItems,
        savedAt: now,
        payments: [],
        customerId,
        debtCharged: 0,
        // For the shop's eyes. Nothing branches on it.
        originPortal: true,
        note: String(body.note ?? "").trim().slice(0, 500) || null,
        deliverTo: String(body.deliverTo ?? "").trim().slice(0, 200) || null,
      },
    }).select("id").single();
    if (insertErr) return json({ error: insertErr.message, stage: "insert" }, 500);

    return json({ ok: true, orderId: inserted.id, total, lines: reply });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), stage: "uncaught" }, 500);
  }
});
