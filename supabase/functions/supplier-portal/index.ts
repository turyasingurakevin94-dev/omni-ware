// The ONLY way a supplier's phone learns anything about this shop
// (supplier.html).
//
// A supplier is the fourth identity (0109): not a shop_member, not an
// agent, not a customer, not an auth.users row. They have no row-level
// access to anything. Everything they see is read here with the
// service-role key and built into a response key by key.
//
// WHAT MUST NEVER CROSS THIS BOUNDARY (docs/supplier-platform.md, C3):
//
//   · the buyer — saved_quotes.client_name / client_phone, payload.client,
//     customerId, agent names. A supplier who can see who is buying can
//     sell to them direct.
//   · the sell price — `sellPrice` on an order line, any markup, margin
//     or discount. The supplier sees THEIR price (`price` on the line,
//     which is what the shop pays them) and nothing else.
//   · any other supplier — their lines on a shared order, their prices,
//     their names, rival_prices, sourcing candidates.
//   · the shop's own stock — counts and lots that are not this supplier's
//     consignment.
//
// The rule the tests enforce is simpler than the list: a row read from
// saved_quotes, purchase_invoices, prices, products, stock_lots or
// suppliers is NEVER spread into a response, and `sellPrice`,
// `client_name`, `client_phone` and `customerName` are never read at all.
//
// WHAT A SUPPLIER SAYS lands in 0109's own tables — supplier_answers and
// supplier_proposals — and is never written into an order or a price.
// The one exception is out of stock (C5): a fact about their own goods,
// written onto their own price row.
//
// Helpers are duplicated verbatim where they mirror another function or
// index.html (functions here are pasted into the dashboard one file at a
// time). test/supplier-portal.test.js pins the copies.
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
// Identity — duplicated verbatim from client-portal.
// ---------------------------------------------------------------------

export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
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

async function hashPin(pin: string, shopId: string, customerId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(`${shopId}:${customerId}`), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Kept in step with supplier-accounts by test.
const PIN_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function pinSubject(supplierId: string): string {
  return `supplier:${supplierId}`;
}

// ---------------------------------------------------------------------
// Dates — Kampala is UTC+3 all year, so "today" is the shop's today.
// ---------------------------------------------------------------------

export function todayISO(now = Date.now()): string {
  return new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86400000);
}

// ---------------------------------------------------------------------
// Orders — mirrors index.html's orderSupplierGroups / orderSupplierTerms.
//
// The terms signature must match the owner app's exactly, or an answer
// given here would read as stale the moment the owner folds it in.
// test/supplier-portal.test.js compares the two over the same orders.
// ---------------------------------------------------------------------

export function supplierLines(payload: any, supplierId: string): any[] {
  const items = payload && payload.items;
  if (!Array.isArray(items)) return [];
  return items.filter(function (it: any) {
    return it && it.supplierId && it.supplierId !== "__stock__" && String(it.supplierId) === String(supplierId);
  });
}

export function supplierTerms(payload: any, supplierId: string): string {
  return supplierLines(payload, supplierId).map(function (it: any) {
    return [
      it.productId,
      it.variantIdx == null ? "" : it.variantIdx,
      Number(it.qty) || 0,
      Math.round(Number(it.price) || 0),
    ].join(":");
  }).join("|");
}

// One line as the supplier sees it: what, how many, at THEIR price. The
// line's sellPrice is never read — not to total, not to check.
function lineView(it: any) {
  const qty = Number(it && it.qty) || 0;
  const price = Math.round(Number(it && it.price) || 0);
  return {
    lineId: it && it.lineId != null ? it.lineId : null,
    name: String((it && it.productName) || ""),
    qty,
    unit: String((it && it.unit) || ""),
    price,
    total: qty * price,
  };
}

// ---------------------------------------------------------------------
// Bills — mirrors index.html's purchaseInvoiceTotal and supBillDue.
// ---------------------------------------------------------------------

export function billTotal(p: any): number {
  const items = Array.isArray(p && p.items) ? p.items : [];
  const goods = items.reduce(function (s: number, it: any) {
    return s + (Number(it && it.qty) || 0) * (Number(it && it.price) || 0);
  }, 0);
  const credits = (Array.isArray(p && p.credits) ? p.credits : []).reduce(function (s: number, sc: any) {
    return s + (sc && !sc.voided ? Number(sc.amount) || 0 : 0);
  }, 0);
  return goods + Math.max(0, Number(p && p.transport) || 0) - credits;
}

export function billDue(p: any, date: string, termsDays: unknown): string | null {
  const own = String((p && p.dueDate) || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(own)) return own;
  if (termsDays == null || termsDays === "" || !date) return null;
  return addDaysISO(String(date).slice(0, 10), Math.max(0, Number(termsDays) || 0));
}

export function billLabel(id: unknown): string {
  return "PINV-" + String(id).padStart(4, "0");
}

// The goods on a bill, by name only: "Cement 20 · Nails 30".
function billItemsText(p: any): string {
  const items = Array.isArray(p && p.items) ? p.items : [];
  return items.slice(0, 3).map(function (it: any) {
    const name = String((it && (it.productName || it.name)) || "").split(" ").slice(0, 2).join(" ");
    return name + " " + (Number(it && it.qty) || 0);
  }).join(" · ") + (items.length > 3 ? " +" + (items.length - 3) : "");
}

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

async function sessionSupplier(shopId: string, token: string) {
  if (!token) return null;
  const { data } = await admin
    .from("supplier_sessions")
    .select("id, shop_id, supplier_id, expires_at, revoked_at")
    .eq("shop_id", shopId)
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (Date.parse(data.expires_at) <= Date.now()) return null;
  const { data: acct } = await admin
    .from("supplier_accounts").select("status")
    .eq("shop_id", shopId).eq("supplier_id", data.supplier_id).maybeSingle();
  if (!acct || acct.status !== "active") return null;
  return data;
}

// ---------------------------------------------------------------------
// Readers. Each selects named columns and returns plain values; none of
// them hands a row back to a caller that could spread it.
// ---------------------------------------------------------------------

async function readSupplier(shopId: string, supplierId: string) {
  const { data } = await admin
    .from("suppliers").select("name, location, terms_days")
    .eq("shop_id", shopId).eq("id", supplierId).maybeSingle();
  return {
    name: String((data && data.name) || ""),
    location: String((data && data.location) || ""),
    termsDays: data && data.terms_days != null ? Number(data.terms_days) : null,
  };
}

async function readBills(shopId: string, supplierId: string, termsDays: number | null) {
  const { data } = await admin
    .from("purchase_invoices").select("id, date, payload")
    .eq("shop_id", shopId)
    .eq("payload->>supplierId", supplierId);
  const today = todayISO();
  return (data || []).filter(function (r: any) {
    return r && r.payload && !r.payload.voided;
  }).map(function (r: any) {
    const p = r.payload;
    const total = Math.round(billTotal(p));
    const paid = Math.round(Number(p.amountPaid) || 0);
    const balance = Math.max(0, total - paid);
    const date = String(r.date || "").slice(0, 10);
    const due = billDue(p, date, termsDays);
    const payments = (Array.isArray(p.payments) ? p.payments : []).filter(function (x: any) {
      return x && Number(x.amount) > 0;
    }).map(function (x: any) {
      return { date: String(x.date || "").slice(0, 10), amount: Math.round(Number(x.amount) || 0) };
    });
    const lastPaid = payments.length ? payments.map(function (x: any) { return x.date; }).sort().slice(-1)[0] : null;
    return {
      id: r.id,
      label: billLabel(r.id),
      date,
      due,
      items: billItemsText(p),
      total,
      paid,
      balance,
      overdueDays: balance > 0 && due && due < today ? daysBetween(due, today) : 0,
      payments,
      lastPaid,
      // On time = settled on or before its due date.
      settledOnTime: balance === 0 && total > 0 ? (!due || !lastPaid || lastPaid <= due) : null,
    };
  }).sort(function (a: any, b: any) { return a.date < b.date ? 1 : -1; });
}

async function readSupplierPrices(shopId: string, supplierId: string) {
  const { data: rows } = await admin
    .from("prices")
    .select("id, product_id, variant_idx, wholesale, retail, date, unit, pack_unit, pack_qty, out_of_stock, tiers")
    .eq("shop_id", shopId).eq("supplier_id", supplierId);
  const ids = Array.from(new Set((rows || []).map(function (r: any) { return r.product_id; })));
  const names: Record<string, { name: string; category: string; variants: any[] }> = {};
  if (ids.length) {
    const { data: products } = await admin
      .from("products").select("id, name, category, variants")
      .eq("shop_id", shopId).in("id", ids);
    (products || []).forEach(function (p: any) {
      names[p.id] = {
        name: String(p.name || ""),
        category: String(p.category || ""),
        variants: Array.isArray(p.variants) ? p.variants : [],
      };
    });
  }
  return (rows || []).map(function (r: any) {
    const prod = names[r.product_id] || { name: "", category: "", variants: [] };
    const vi = r.variant_idx == null || r.variant_idx === "" ? null : Number(r.variant_idx);
    const variant = vi != null ? prod.variants[vi] : null;
    const variantLabel = variant ? String(variant.label || variant.name || "") : "";
    return {
      priceId: r.id,
      productId: String(r.product_id),
      variantIdx: vi,
      name: prod.name + (variantLabel ? " " + variantLabel : ""),
      category: prod.category,
      unit: String(r.unit || ""),
      packUnit: String(r.pack_unit || ""),
      packQty: Number(r.pack_qty) || 0,
      unitPrice: r.retail == null ? null : Math.round(Number(r.retail)),
      packPrice: r.wholesale == null ? null : Math.round(Number(r.wholesale)),
      tiers: (Array.isArray(r.tiers) ? r.tiers : []).map(function (t: any) {
        return { from: Number(t && (t.minQty ?? t.from ?? t.qty)) || 0, price: Math.round(Number(t && (t.price ?? t.unitPrice)) || 0) };
      }).filter(function (t: any) { return t.from > 0 && t.price > 0; }),
      date: r.date ? String(r.date).slice(0, 10) : null,
      outOfStock: !!r.out_of_stock,
    };
  });
}

function stockKey(productId: string, variantIdx: number | null): string {
  return variantIdx == null ? productId : `${productId}::${variantIdx}`;
}

async function readConsignedLots(shopId: string, supplierId: string) {
  const { data } = await admin
    .from("stock_lots").select("key, qty, cost")
    .eq("shop_id", shopId).eq("consign", supplierId);
  const byKey: Record<string, { qty: number; value: number }> = {};
  (data || []).forEach(function (l: any) {
    const n = Number(l.qty) || 0;
    if (!(n > 0)) return;
    const rec = byKey[l.key] || (byKey[l.key] = { qty: 0, value: 0 });
    rec.qty += n;
    rec.value += n * (Number(l.cost) || 0);
  });
  return byKey;
}

// Invoiced, unvoided orders inside [fromISO, toISO]. Read once and walked
// for this supplier's lines and consigned lots; nothing about the buyer
// is touched.
async function readInvoicedOrders(shopId: string, fromISO: string, toISO: string) {
  const { data } = await admin
    .from("saved_quotes").select("id, invoiced, invoiced_at, date, voided, payload")
    .eq("shop_id", shopId).eq("invoiced", true).eq("voided", false)
    .gte("invoiced_at", fromISO).lte("invoiced_at", toISO);
  return data || [];
}

type Sale = { key: string; name: string; qty: number; value: number; day: string; agent: string };

// What this supplier sold through the shop: lines bought from them for an
// order, and their consigned goods that left the shelf on an invoice.
// Valued at THEIR price, never the sell price.
export function supplierSales(rows: any[], supplierId: string): Sale[] {
  const out: Sale[] = [];
  rows.forEach(function (q: any) {
    const p = q && q.payload;
    if (!p || !Array.isArray(p.items)) return;
    const day = String(q.invoiced_at || q.date || "").slice(0, 10);
    const agent = String(p.originAgentId || p.agentId || "");
    p.items.forEach(function (it: any) {
      if (!it) return;
      const key = stockKey(String(it.productId || ""), it.variantIdx == null || it.variantIdx === "" ? null : Number(it.variantIdx));
      const name = String(it.productName || "");
      if (String(it.supplierId) === String(supplierId)) {
        const qty = Number(it.qty) || 0;
        out.push({ key, name, qty, value: qty * (Number(it.price) || 0), day, agent });
      }
      (Array.isArray(it._stockLots) ? it._stockLots : []).forEach(function (l: any) {
        if (!l || String(l.consign) !== String(supplierId)) return;
        const qty = Number(l.qty) || 0;
        out.push({ key, name, qty, value: qty * (Number(l.cost) || 0), day, agent });
      });
    });
  });
  return out;
}

async function readAsks(shopId: string, supplierId: string) {
  const { data: orders } = await admin
    .from("saved_quotes").select("id, status, voided, date, payload")
    .eq("shop_id", shopId).eq("status", "draft").eq("voided", false);
  const mine = (orders || []).filter(function (q: any) {
    const p = q.payload || {};
    const rec = (p.supplierConfirms || {})[String(supplierId)] || {};
    // Only orders the shop has actually asked them about.
    return supplierLines(p, supplierId).length > 0 && !!rec.askedAt;
  });
  if (!mine.length) return [];
  const { data: answers } = await admin
    .from("supplier_answers").select("order_id, terms, state, at")
    .eq("shop_id", shopId).eq("supplier_id", supplierId)
    .in("order_id", mine.map(function (q: any) { return q.id; }));
  return mine.map(function (q: any) {
    const p = q.payload || {};
    const terms = supplierTerms(p, supplierId);
    const rec = (p.supplierConfirms || {})[String(supplierId)] || {};
    const answered = (answers || []).some(function (a: any) { return a.order_id === q.id && a.terms === terms; })
      || (rec.state === "confirmed" && rec.terms === terms);
    if (answered) return null;
    const lines = supplierLines(p, supplierId).map(lineView);
    return {
      orderId: q.id,
      askedAt: rec.askedAt || null,
      items: lines.length,
      total: lines.reduce(function (s: number, l: any) { return s + l.total; }, 0),
      lines,
    };
  }).filter(Boolean);
}

async function readTrips(shopId: string, supplierId: string, statuses: string[]) {
  const { data } = await admin
    .from("collection_trips")
    .select("id, status, assigned_worker_id, created_at, assigned_at, collected_at, confirmed_at, lines, voided")
    .eq("shop_id", shopId).eq("supplier_id", supplierId).eq("voided", false)
    .in("status", statuses)
    .order("created_at", { ascending: false }).limit(20);
  const workerIds = Array.from(new Set((data || []).map(function (t: any) { return t.assigned_worker_id; }).filter(Boolean)));
  const workers: Record<string, string> = {};
  if (workerIds.length) {
    const { data: staff } = await admin.from("staff").select("id, name").eq("shop_id", shopId).in("id", workerIds);
    (staff || []).forEach(function (s: any) {
      // First name and an initial: enough to recognise the rider at the
      // stall, not a contact card.
      const parts = String(s.name || "").trim().split(/\s+/);
      workers[s.id] = parts[0] + (parts[1] ? " " + parts[1].charAt(0) + "." : "");
    });
  }
  return (data || []).map(function (t: any) {
    const lines = (Array.isArray(t.lines) ? t.lines : []).map(function (l: any) {
      const qty = Number(l && l.qty) || 0;
      const got = l && l.gotQty != null ? Number(l.gotQty) : null;
      return { name: String((l && l.productName) || ""), unit: String((l && l.unit) || ""), sent: qty, counted: got };
    });
    return {
      tripId: String(t.id),
      status: String(t.status),
      rider: t.assigned_worker_id ? (workers[t.assigned_worker_id] || "") : "",
      assignedAt: t.assigned_at || null,
      collectedAt: t.collected_at || null,
      confirmedAt: t.confirmed_at || null,
      lines,
    };
  });
}

// ---------------------------------------------------------------------

function ageing(bills: any[], today: string) {
  let late = 0, week = 0, later = 0;
  const weekEnd = addDaysISO(today, 7);
  bills.forEach(function (b: any) {
    if (!(b.balance > 0)) return;
    if (b.due && b.due < today) late += b.balance;
    else if (b.due && b.due <= weekEnd) week += b.balance;
    else later += b.balance;
  });
  return { late, week, later, total: late + week + later };
}

function nextPayment(bills: any[], today: string) {
  const open = bills.filter(function (b: any) { return b.balance > 0 && b.due && b.due >= today; });
  if (!open.length) return null;
  const first = open.map(function (b: any) { return b.due; }).sort()[0];
  return {
    date: first,
    amount: open.filter(function (b: any) { return b.due === first; }).reduce(function (s: number, b: any) { return s + b.balance; }, 0),
  };
}

function onTimeRecord(bills: any[]) {
  const settled = bills.filter(function (b: any) { return b.settledOnTime !== null; }).slice(0, 12);
  return {
    onTime: settled.filter(function (b: any) { return b.settledOnTime; }).length,
    of: settled.length,
    months: settled.map(function (b: any) { return { label: b.label, onTime: !!b.settledOnTime }; }).reverse(),
  };
}

function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
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
    // verify — the PIN the shop sent, for a session. There is no
    // "start": a supplier never asks this endpoint to mint a PIN.
    // -----------------------------------------------------------------
    if (action === "verify") {
      const phone = normalisePhone(body.phone);
      const pin = String(body.pin ?? "").trim();
      const deviceId = String(body.deviceId ?? "").trim().slice(0, 120);
      if (!phone || !/^\d{4}$/.test(pin) || !deviceId) {
        return json({ error: "Enter your phone and the four figures Omni-Ware sent you" }, 400);
      }
      const { data: account } = await admin
        .from("supplier_accounts")
        .select("supplier_id, pin_hash, pin_expires_at, pin_attempts, status")
        .eq("shop_id", shopId).eq("phone", phone).maybeSingle();

      if (!account || account.status !== "active" || !account.pin_hash) {
        return json({ error: "That PIN is not right", triesLeft: 0 }, 401);
      }
      if (!account.pin_expires_at || Date.parse(account.pin_expires_at) <= Date.now()) {
        return json({ error: "That PIN has run out. Ask Omni-Ware for a new one." }, 401);
      }
      if ((account.pin_attempts || 0) >= PIN_MAX_ATTEMPTS) {
        return json({ error: "Locked after too many tries. Ask Omni-Ware for a new PIN." }, 429);
      }
      const ok = safeEqual(account.pin_hash, await hashPin(pin, shopId, pinSubject(account.supplier_id)));
      if (!ok) {
        const attempts = (account.pin_attempts || 0) + 1;
        await admin.from("supplier_accounts").update({ pin_attempts: attempts })
          .eq("shop_id", shopId).eq("supplier_id", account.supplier_id);
        return json({ error: "Wrong PIN", triesLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts) }, 401);
      }
      // Spent on use.
      await admin.from("supplier_accounts").update({
        pin_hash: null, pin_expires_at: null, pin_attempts: 0, pin_requested_at: null,
        last_seen_at: new Date().toISOString(),
      }).eq("shop_id", shopId).eq("supplier_id", account.supplier_id);

      const token = mintToken();
      await admin.from("supplier_sessions").insert({
        shop_id: shopId,
        supplier_id: account.supplier_id,
        token_hash: await sha256Hex(token),
        device_id: deviceId,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });
      const sup = await readSupplier(shopId, account.supplier_id);
      return json({ ok: true, token, name: sup.name });
    }

    // -----------------------------------------------------------------
    // ask_pin — "Forgot PIN?". Flags the account for the owner and says
    // the same thing whether or not the number has one.
    // -----------------------------------------------------------------
    if (action === "ask_pin") {
      const phone = normalisePhone(body.phone);
      if (phone) {
        await admin.from("supplier_accounts")
          .update({ pin_requested_at: new Date().toISOString() })
          .eq("shop_id", shopId).eq("phone", phone).eq("status", "active");
      }
      return json({ ok: true });
    }

    // Everything below needs a session.
    const session = await sessionSupplier(shopId, String(body.token ?? ""));
    if (!session) return json({ error: "Sign in again" }, 401);
    const supplierId = String(session.supplier_id);
    await admin.from("supplier_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
    const today = todayISO();

    if (action === "signout") {
      await admin.from("supplier_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    // home — Today: what we owe, what needs them, and a glance.
    // -----------------------------------------------------------------
    if (action === "home") {
      const sup = await readSupplier(shopId, supplierId);
      const [bills, asks, prices, lots, trips, sales] = await Promise.all([
        readBills(shopId, supplierId, sup.termsDays),
        readAsks(shopId, supplierId),
        readSupplierPrices(shopId, supplierId),
        readConsignedLots(shopId, supplierId),
        readTrips(shopId, supplierId, ["assigned", "collecting"]),
        readInvoicedOrders(shopId, monthStart(today), today).then(function (rows: any[]) { return supplierSales(rows, supplierId); }),
      ]);
      const owed = ageing(bills, today);
      const stale = prices.filter(function (p: any) {
        return !p.outOfStock && p.date && daysBetween(p.date, today) > 30;
      }).sort(function (a: any, b: any) { return a.date < b.date ? -1 : 1; }).slice(0, 3);
      const shelf = Object.keys(lots).reduce(function (s: number, k: string) { return s + lots[k].value; }, 0);
      return json({
        ok: true,
        supplier: { name: sup.name },
        today,
        owed: { total: owed.total, late: owed.late, week: owed.week, later: owed.later },
        next: nextPayment(bills, today),
        asks: {
          orders: asks.map(function (a: any) { return { orderId: a.orderId, items: a.items, total: a.total, askedAt: a.askedAt }; }),
          prices: stale.map(function (p: any) {
            return { priceId: p.priceId, name: p.name, unit: p.unit, price: p.unitPrice ?? p.packPrice, ageDays: daysBetween(p.date, today) };
          }),
          pickups: trips.map(function (t: any) {
            return { tripId: t.tripId, rider: t.rider, items: t.lines.length, status: t.status };
          }),
        },
        glance: {
          soldMonth: Math.round(sales.reduce(function (s: number, x: Sale) { return s + x.value; }, 0)),
          stockValue: Math.round(shelf),
          onTime: onTimeRecord(bills),
        },
      });
    }

    // -----------------------------------------------------------------
    // order — one order's lines for THIS supplier, and answer.
    // -----------------------------------------------------------------
    if (action === "order" || action === "answer") {
      const orderId = Number(body.orderId);
      if (!Number.isFinite(orderId)) return json({ error: "Which order?" }, 400);
      const { data: q } = await admin
        .from("saved_quotes").select("id, status, voided, payload")
        .eq("shop_id", shopId).eq("id", orderId).maybeSingle();
      const lines = q && !q.voided ? supplierLines(q.payload, supplierId) : [];
      if (!q || !lines.length) return json({ error: "That order is not one of yours" }, 404);
      const terms = supplierTerms(q.payload, supplierId);

      if (action === "order") {
        const rec = ((q.payload || {}).supplierConfirms || {})[String(supplierId)] || {};
        return json({
          ok: true,
          orderId: q.id,
          open: q.status === "draft",
          askedAt: rec.askedAt || null,
          terms,
          lines: lines.map(lineView),
        });
      }

      if (q.status !== "draft") return json({ error: "This order has moved on. Omni-Ware will call you if anything changed." }, 409);
      const state = String(body.state ?? "");
      if (!["confirmed", "short", "none"].includes(state)) return json({ error: "Answer have all, short or none" }, 400);
      if (String(body.terms ?? "") !== terms) {
        return json({ error: "This order changed while you were looking. Open it again." }, 409);
      }
      const known = new Set(lines.map(function (l: any) { return String(l.lineId); }));
      const changes = state === "short"
        ? (Array.isArray(body.changes) ? body.changes : []).map(function (c: any) {
            return { lineId: c && c.lineId, have: Math.max(0, Math.floor(Number(c && c.have) || 0)) };
          }).filter(function (c: any) { return known.has(String(c.lineId)); })
        : [];
      const { error } = await admin.from("supplier_answers").insert({
        shop_id: shopId, order_id: orderId, supplier_id: supplierId,
        state, terms, changes, note: String(body.note ?? "").slice(0, 300),
      });
      if (error) return json({ error: error.message, stage: "answer" }, 500);
      return json({ ok: true, state });
    }

    // -----------------------------------------------------------------
    // products — their own price list, and what they have proposed.
    // -----------------------------------------------------------------
    if (action === "products") {
      const [prices, lots, { data: open }] = await Promise.all([
        readSupplierPrices(shopId, supplierId),
        readConsignedLots(shopId, supplierId),
        admin.from("supplier_proposals").select("id, kind, price_id, product_id, status, created_at, decided_at")
          .eq("shop_id", shopId).eq("supplier_id", supplierId)
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      return json({
        ok: true,
        today,
        items: prices.map(function (p: any) {
          const prop = (open || []).filter(function (x: any) { return x.price_id === p.priceId; })
            .sort(function (a: any, b: any) { return a.created_at < b.created_at ? 1 : -1; })[0];
          const lot = lots[stockKey(p.productId, p.variantIdx)];
          return {
            priceId: p.priceId,
            name: p.name,
            category: p.category,
            unit: p.unit,
            packUnit: p.packUnit,
            packQty: p.packQty,
            unitPrice: p.unitPrice,
            packPrice: p.packPrice,
            tiers: p.tiers,
            checkedDays: p.date ? daysBetween(p.date, today) : null,
            outOfStock: p.outOfStock,
            consigned: lot ? lot.qty : 0,
            proposal: prop ? { kind: prop.kind, status: prop.status, at: prop.created_at } : null,
          };
        }),
        pendingNew: (open || []).filter(function (x: any) { return (x.kind === "new" || x.kind === "add") && x.status === "pending"; }).length,
      });
    }

    // still / price / stock — about one or more of THEIR price rows.
    if (action === "still" || action === "price" || action === "stock") {
      const ids = (Array.isArray(body.priceIds) ? body.priceIds : [body.priceId]).map(Number).filter(Number.isFinite);
      if (!ids.length) return json({ error: "Which item?" }, 400);
      const { data: owned } = await admin.from("prices").select("id, product_id")
        .eq("shop_id", shopId).eq("supplier_id", supplierId).in("id", ids);
      if (!owned || owned.length !== ids.length) return json({ error: "That is not one of your items" }, 404);

      if (action === "stock") {
        const out = !!body.out;
        const { error } = await admin.from("prices")
          .update({ out_of_stock: out, out_of_stock_since: out ? today : null })
          .eq("shop_id", shopId).eq("supplier_id", supplierId).in("id", ids);
        if (error) return json({ error: error.message, stage: "stock" }, 500);
        return json({ ok: true, outOfStock: out });
      }

      if (action === "still") {
        const { error } = await admin.from("supplier_proposals").insert(owned.map(function (r: any) {
          return { shop_id: shopId, supplier_id: supplierId, kind: "still", price_id: r.id, product_id: r.product_id, payload: {} };
        }));
        if (error) return json({ error: error.message, stage: "still" }, 500);
        return json({ ok: true, sent: owned.length });
      }

      const unitPrice = Math.round(Number(body.unitPrice) || 0);
      if (!(unitPrice > 0)) return json({ error: "Type the new price" }, 400);
      const { error } = await admin.from("supplier_proposals").insert({
        shop_id: shopId, supplier_id: supplierId, kind: "price", price_id: owned[0].id, product_id: owned[0].product_id,
        payload: {
          unitPrice,
          lines: cleanPriceLines(body.lines),
          packing: cleanPacking(body.packing),
        },
      });
      if (error) return json({ error: error.message, stage: "price" }, 500);
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    // catalogue — products they could start supplying. Names and
    // categories only; who else supplies them is never said.
    // -----------------------------------------------------------------
    if (action === "catalogue") {
      const [{ data: products }, { data: mine }] = await Promise.all([
        admin.from("products").select("id, name, category").eq("shop_id", shopId).order("name").limit(2000),
        admin.from("prices").select("product_id").eq("shop_id", shopId).eq("supplier_id", supplierId),
      ]);
      const sells = new Set((mine || []).map(function (r: any) { return String(r.product_id); }));
      const categories = Array.from(new Set((products || []).map(function (p: any) { return String(p.category || ""); }).filter(Boolean))).sort();
      return json({
        ok: true,
        categories,
        products: (products || []).map(function (p: any) {
          return { productId: String(p.id), name: String(p.name || ""), category: String(p.category || ""), mine: sells.has(String(p.id)) };
        }),
      });
    }

    // add / new — products they want to supply, with their prices.
    if (action === "add") {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50);
      if (!items.length) return json({ error: "Pick at least one product" }, 400);
      const ids = items.map(function (x: any) { return String(x && x.productId); });
      const { data: exists } = await admin.from("products").select("id").eq("shop_id", shopId).in("id", ids);
      const ok = new Set((exists || []).map(function (r: any) { return String(r.id); }));
      const rows = items.filter(function (x: any) { return ok.has(String(x && x.productId)); }).map(function (x: any) {
        return {
          shop_id: shopId, supplier_id: supplierId, kind: "add", product_id: String(x.productId),
          payload: { lines: cleanPriceLines(x.lines) },
        };
      });
      if (!rows.length) return json({ error: "Those products are not in the catalogue" }, 400);
      const { error } = await admin.from("supplier_proposals").insert(rows);
      if (error) return json({ error: error.message, stage: "add" }, 500);
      return json({ ok: true, sent: rows.length });
    }

    if (action === "new") {
      const name = String(body.name ?? "").trim().slice(0, 120);
      if (!name) return json({ error: "Give the item a name" }, 400);
      const { error } = await admin.from("supplier_proposals").insert({
        shop_id: shopId, supplier_id: supplierId, kind: "new",
        payload: {
          name,
          category: String(body.category ?? "").slice(0, 80),
          packing: cleanPacking(body.packing),
          lines: cleanPriceLines(body.lines),
        },
      });
      if (error) return json({ error: error.message, stage: "new" }, 500);
      return json({ ok: true });
    }

    // -----------------------------------------------------------------
    // money — bills, payments, commission and the on-time record.
    // -----------------------------------------------------------------
    if (action === "money") {
      const sup = await readSupplier(shopId, supplierId);
      const [bills, { data: commissions }] = await Promise.all([
        readBills(shopId, supplierId, sup.termsDays),
        admin.from("supplier_commissions").select("period, amount")
          .eq("shop_id", shopId).eq("supplier_id", supplierId).order("period", { ascending: false }).limit(12),
      ]);
      const owed = ageing(bills, today);
      const payments: any[] = [];
      bills.forEach(function (b: any) {
        b.payments.forEach(function (p: any) { payments.push({ date: p.date, amount: p.amount, bill: b.label }); });
      });
      payments.sort(function (a: any, b: any) { return a.date < b.date ? 1 : -1; });
      return json({
        ok: true,
        today,
        termsDays: sup.termsDays,
        owed,
        next: nextPayment(bills, today),
        bills: bills.map(function (b: any) {
          return {
            label: b.label, date: b.date, due: b.due, items: b.items,
            total: b.total, balance: b.balance, overdueDays: b.overdueDays,
            status: b.balance === 0 ? "paid" : b.overdueDays > 0 ? "late" : (b.due && b.due <= addDaysISO(today, 7) ? "soon" : "later"),
            lastPaid: b.lastPaid,
          };
        }),
        payments: payments.slice(0, 50),
        commissions: (commissions || []).map(function (c: any) { return { period: String(c.period), amount: Math.round(Number(c.amount) || 0) }; }),
        onTime: onTimeRecord(bills),
      });
    }

    // -----------------------------------------------------------------
    // consigned — their goods on the shop's shelf, and what has sold.
    // -----------------------------------------------------------------
    if (action === "consigned") {
      const lots = await readConsignedLots(shopId, supplierId);
      const since = addDaysISO(today, -180);
      const sales = supplierSales(await readInvoicedOrders(shopId, since, today), supplierId);
      const keys = Object.keys(lots);
      const productIds = Array.from(new Set(keys.map(function (k) { return k.split("::")[0]; })));
      const names: Record<string, string> = {};
      if (productIds.length) {
        const { data: products } = await admin.from("products").select("id, name").eq("shop_id", shopId).in("id", productIds);
        (products || []).forEach(function (p: any) { names[p.id] = String(p.name || ""); });
      }
      const { data: counts } = keys.length
        ? await admin.from("stock_log").select("key, date, type").eq("shop_id", shopId).in("key", keys).eq("type", "count")
            .order("date", { ascending: false }).limit(200)
        : { data: [] as any[] };
      const items = keys.map(function (k) {
        const sold = sales.filter(function (s) { return s.key === k; });
        const soldQty = sold.reduce(function (n, s) { return n + s.qty; }, 0);
        const soldValue = sold.reduce(function (n, s) { return n + s.value; }, 0);
        const lastSale = sold.map(function (s) { return s.day; }).sort().slice(-1)[0] || null;
        const lastCount = (counts || []).find(function (c: any) { return c.key === k; });
        return {
          key: k,
          name: names[k.split("::")[0]] || "",
          onShelf: lots[k].qty,
          shelfValue: Math.round(lots[k].value),
          sold: soldQty,
          soldValue: Math.round(soldValue),
          lastSale,
          daysSinceSale: lastSale ? daysBetween(lastSale, today) : null,
          lastCount: lastCount ? String(lastCount.date || "").slice(0, 10) : null,
        };
      });
      return json({
        ok: true,
        today,
        items,
        shelfValue: items.reduce(function (n, i) { return n + i.shelfValue; }, 0),
        shelfQty: items.reduce(function (n, i) { return n + i.onShelf; }, 0),
        soldValue: items.reduce(function (n, i) { return n + i.soldValue; }, 0),
        soldQty: items.reduce(function (n, i) { return n + i.sold; }, 0),
      });
    }

    // -----------------------------------------------------------------
    // insights — what sold through the shop, in units and at THEIR price.
    // -----------------------------------------------------------------
    if (action === "insights") {
      const period = ["7d", "30d", "90d"].includes(String(body.period)) ? String(body.period) : "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const from = addDaysISO(today, -(days - 1));
      const prevFrom = addDaysISO(from, -days);
      const rows = await readInvoicedOrders(shopId, prevFrom, today);
      const all = supplierSales(rows, supplierId);
      const cur = all.filter(function (s) { return s.day >= from; });
      const prev = all.filter(function (s) { return s.day < from; });
      const bucketDays = days === 7 ? 1 : 7;
      const buckets: number[] = [];
      for (let i = 0; i < Math.ceil(days / bucketDays); i++) buckets.push(0);
      cur.forEach(function (s) {
        const i = Math.min(buckets.length - 1, Math.floor(daysBetween(from, s.day) / bucketDays));
        buckets[i] += s.qty;
      });
      const byKey: Record<string, { name: string; qty: number; prev: number }> = {};
      cur.forEach(function (s) { (byKey[s.key] ||= { name: s.name, qty: 0, prev: 0 }).qty += s.qty; });
      prev.forEach(function (s) { if (byKey[s.key]) byKey[s.key].prev += s.qty; });
      const { count: agentsTotal } = await admin.from("agents").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
      const agents = new Set(cur.map(function (s) { return s.agent; }).filter(Boolean)).size;
      const value = cur.reduce(function (n, s) { return n + s.value; }, 0);
      const prevValue = prev.reduce(function (n, s) { return n + s.value; }, 0);
      return json({
        ok: true,
        period,
        value: Math.round(value),
        change: prevValue > 0 ? Math.round((value - prevValue) / prevValue * 100) : null,
        units: Math.round(cur.reduce(function (n, s) { return n + s.qty; }, 0)),
        agents,
        agentsTotal: agentsTotal || 0,
        series: buckets.map(function (n) { return Math.round(n); }),
        bucket: bucketDays === 1 ? "day" : "week",
        best: Object.keys(byKey).map(function (k) {
          const r = byKey[k];
          return { name: r.name, units: Math.round(r.qty), change: r.prev > 0 ? Math.round((r.qty - r.prev) / r.prev * 100) : null };
        }).sort(function (a, b) { return b.units - a.units; }).slice(0, 5),
      });
    }

    // -----------------------------------------------------------------
    // trips — pickups, and the goods-received record for each.
    // -----------------------------------------------------------------
    if (action === "trips") {
      const trips = await readTrips(shopId, supplierId, ["assigned", "collecting", "collected", "confirmed"]);
      return json({ ok: true, trips });
    }

    // -----------------------------------------------------------------
    // partnership — the two-way record.
    // -----------------------------------------------------------------
    if (action === "partnership") {
      const sup = await readSupplier(shopId, supplierId);
      const [bills, prices, { data: answers }, trips] = await Promise.all([
        readBills(shopId, supplierId, sup.termsDays),
        readSupplierPrices(shopId, supplierId),
        admin.from("supplier_answers").select("state, at").eq("shop_id", shopId).eq("supplier_id", supplierId)
          .gte("at", new Date(Date.now() - 90 * 86400000).toISOString()),
        readTrips(shopId, supplierId, ["collected", "confirmed"]),
      ]);
      const a = answers || [];
      const live = prices.filter(function (p: any) { return !p.outOfStock; });
      const counted = trips.filter(function (t: any) { return t.lines.every(function (l: any) { return l.counted != null; }); });
      return json({
        ok: true,
        termsDays: sup.termsDays,
        you: {
          answered: a.length,
          filled: a.length ? Math.round(a.filter(function (x: any) { return x.state === "confirmed"; }).length / a.length * 100) : null,
          pricesCurrent: live.length ? Math.round(live.filter(function (p: any) { return p.date && daysBetween(p.date, today) <= 30; }).length / live.length * 100) : null,
          stalePrices: live.filter(function (p: any) { return !p.date || daysBetween(p.date, today) > 30; }).length,
        },
        us: {
          onTime: onTimeRecord(bills),
          pickupsCounted: counted.length,
          pickups: trips.length,
        },
      });
    }

    // -----------------------------------------------------------------
    // profile / prefs — who they are to the shop, and how to reach them.
    // -----------------------------------------------------------------
    if (action === "profile") {
      const sup = await readSupplier(shopId, supplierId);
      const { data: acct } = await admin.from("supplier_accounts").select("phone, prefs, created_at")
        .eq("shop_id", shopId).eq("supplier_id", supplierId).maybeSingle();
      const phone = String((acct && acct.phone) || "");
      return json({
        ok: true,
        name: sup.name,
        location: sup.location,
        termsDays: sup.termsDays,
        phoneEnding: phone.slice(-3),
        since: acct && acct.created_at ? String(acct.created_at).slice(0, 10) : null,
        prefs: cleanPrefs(acct && acct.prefs),
      });
    }

    if (action === "prefs") {
      const prefs = cleanPrefs(body.prefs);
      const { error } = await admin.from("supplier_accounts").update({ prefs })
        .eq("shop_id", shopId).eq("supplier_id", supplierId);
      if (error) return json({ error: error.message, stage: "prefs" }, 500);
      return json({ ok: true, prefs });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), stage: "uncaught" }, 500);
  }
});

// ---------------------------------------------------------------------
// Input cleaners. A proposal carries what the supplier typed, bounded and
// typed, never an object passed through as it arrived.
// ---------------------------------------------------------------------

// [{label, qty, price}] — "1 length → 41,000", "10 or more → 39,500".
export function cleanPriceLines(raw: unknown): any[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 8).map(function (l: any) {
    return {
      label: String((l && l.label) || "").slice(0, 40),
      qty: Math.max(0, Number(l && l.qty) || 0),
      price: Math.round(Number(l && l.price) || 0),
    };
  }).filter(function (l: any) { return l.price > 0; });
}

// [{pack, has, of}] — "1 Ctn has 20 dozens".
export function cleanPacking(raw: unknown): any[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 4).map(function (p: any) {
    return {
      pack: String((p && p.pack) || "").slice(0, 20),
      has: Math.max(0, Number(p && p.has) || 0),
      of: String((p && p.of) || "").slice(0, 20),
    };
  }).filter(function (p: any) { return p.pack && p.has > 0 && p.of; });
}

const PREF_KEYS = ["pickups", "received", "payments", "prices", "weekly"];

export function cleanPrefs(raw: unknown): any {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const ch: any = {};
  PREF_KEYS.forEach(function (k) {
    const v = r.channels && r.channels[k];
    ch[k] = { wa: v ? v.wa !== false : true, app: v ? v.app !== false : true };
  });
  return {
    language: r.language === "lg" ? "lg" : "en",
    quiet: r.quiet !== false,
    channels: ch,
  };
}
