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
// Three wrong tries and a PERSON has to be involved again: asking for
// another PIN does not hand out three more guesses, only an admin issuing
// one does (client-accounts), or the customer signing in successfully.
//
// This is the whole defence, and without it the rest is decorative. A PIN
// is four figures — one in ten thousand — and a counter that resets every
// time a new PIN is minted turns that into three fresh guesses on demand:
// burn the attempts, ask for another, repeat. At the shop ceiling of 40
// starts an hour that is roughly 120 guesses an hour against a fresh
// secret each round, which works out near a coin-flip inside a day. Three
// guesses TOTAL until a human vouches for you is a number no amount of
// patience improves on.
//
// The cost is a customer who mistypes three times has to ring the shop.
// At twenty trade accounts that is a phone call, and the same phone call
// that opened the account in the first place.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// A ceiling per shop per hour, stopping a script walking through numbers.
// Same reasoning as catalogue-public, which is the only other endpoint
// here a stranger can reach.
//
// There was a per-phone window here too. It is gone because the rule it
// approximated is now exact: a live PIN is never replaced, so asking
// twice in a minute already does nothing, and asking after the ceiling
// does nothing either. A window measured in seconds was a weaker version
// of both.
const START_SHOP_WINDOW_MS = 60 * 60 * 1000;
const START_SHOP_MAX = 40;

// ---------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------

// The goods, and only the goods. sellPrice is OUR price to THEM;
// `price` on the same line is what the shop paid the supplier, and it is
// never read here — not to total, not to check, not at all.
//
// Split out from the order total the same way index.html splits it, and
// for the same reason: a percent charge has to have something to be a
// percent OF that can never include another charge.
export function goodsTotal(payload: any): number {
  const items = payload && payload.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce(function (sum, it) {
    const qty = Number(it && it.qty) || 0;
    const sell = Number(it && it.sellPrice) || 0;
    return sum + qty * sell;
  }, 0);
}

// A line the shop never priced. index.html's quoteItemSellPrice falls
// back to deriving one from the line's cost and the product's markup —
// and re-deriving anything from cost is the code path that must not
// exist inside this boundary. So such a line counts as nothing here, and
// the order says so rather than quietly totalling low.
export function unpricedLines(payload: any): number {
  const items = payload && payload.items;
  if (!Array.isArray(items)) return 0;
  return items.filter(function (it) {
    const qty = Number(it && it.qty) || 0;
    const missing = !it || it.sellPrice == null || it.sellPrice === "";
    return qty > 0 && missing;
  }).length;
}

// ---------------------------------------------------------------------
// What the shop is actually owed
//
// An order stopped being just its goods: it carries CHARGES the shop
// adds (a delivery, a service) and, where the customer took terms, what
// the credit itself costs. index.html computes
//
//     savedQuoteTotal = goods + charges + creditCharge
//
// and the invoice, the receipt and the debt log all follow it. The
// portal was still showing goods alone — so a customer read a figure
// SMALLER than the invoice they were sent, and smaller than their own
// statement, which is built from the debt log. A portal that disagrees
// with itself is the one failure this whole boundary exists to prevent.
//
// The three functions below mirror index.html's, and a test compares
// them line for line over the same orders.
// ---------------------------------------------------------------------

function chargeAmount(ch: any, goods: number): number {
  if (!ch) return 0;
  const v = Number(ch.value) || 0;
  if (!(v > 0)) return 0;
  return ch.type === "percent"
    ? Math.round((Number(goods) || 0) * v / 100)
    : Math.round(v);
}

// Every charge, named and priced, for the customer to read. A figure on
// an invoice a customer cannot account for is a figure they ring about.
export function chargeLines(payload: any) {
  const charges = (payload && Array.isArray(payload.charges)) ? payload.charges : [];
  const goods = goodsTotal(payload);
  return charges
    .map((ch: any) => ({
      label: String((ch && ch.label) || "").trim() || "Charge",
      amount: chargeAmount(ch, goods),
    }))
    .filter((l: any) => l.amount > 0);
}

// What waiting for the money is worth, as the shop agreed it — a percent
// of the cash total, never of itself. Frozen at the rate on the order, so
// a statement read next year still says the term actually taken.
export function creditLine(payload: any) {
  const c = payload && payload.credit;
  const pct = Number(c && c.pct) || 0;
  if (!(pct > 0)) return null;
  const days = Math.max(0, Number(c && c.days) || 0);
  const cash = goodsTotal(payload) + chargeLines(payload).reduce((s: number, l: any) => s + l.amount, 0);
  return {
    label: days > 0 ? `Credit — ${days} days` : "Credit",
    days,
    amount: Math.round(cash * pct / 100),
  };
}

// THE FIGURE EVERY DOCUMENT THE CUSTOMER HOLDS IS DRAWN FROM.
export function orderTotal(payload: any): number {
  const credit = creditLine(payload);
  return goodsTotal(payload)
    + chargeLines(payload).reduce((s: number, l: any) => s + l.amount, 0)
    + (credit ? credit.amount : 0);
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
// Pricing
//
// The five functions below are duplicated VERBATIM from agent-catalog,
// which is the house pattern and not an oversight: Edge Functions here
// deploy one file at a time through the dashboard, so a shared import
// would fail to deploy. test/client-portal-pricing.test.js compares both
// copies character for character. If either changes, change both.
//
// What is NOT copied is the agent's discount apparatus — computeFloorPrice,
// resolveDiscountPcts, buildFloorPriceLadder and the word "floor price"
// itself. An agent's price is a share of the margin between cost and our
// price; a customer has no discount and no share of anything, so bringing
// that vocabulary across would mean carrying a concept with no meaning
// here and a variable called `margin` inside the customer boundary.
// customerUnitPrice() below composes the copied math into the one number
// a customer is owed.
// ---------------------------------------------------------------------

type MarkupKind = "wholesale" | "retail";
type MarkupRule = { type: string; value: number } | null;

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

// A fixed wholesale markup is naturally an amount added to the PACK price
// (e.g. +10,000 on a 300,000/ctn cost -> 310,000/ctn = 15,500/dzn), not the
// per-unit price -- wholesale is bought and sold by the pack. Percent
// markups don't need this (they scale identically either way). Mirrors
// index.html's own suggestedSellingPrice() exactly.
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

// One shared tier list (row.tiers) covers both sides of the wholesale/
// retail curve -- a tier only counts toward "wholesale" if it needs at
// least a full pack to unlock (the same qty-vs-pack-size line that
// already decides which of the two applies below), otherwise it counts
// toward "retail". Nothing declares which side a tier belongs to; its own
// minQty does.
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

// Cheapest-by-wholesale, tie-broken by retail -- the same ranking the
// admin app's own quote builder uses, so "the best row" means one thing
// across the app.
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

// A price row saved before the tier-list rework (or one that's only ever
// had flat wholesale/retail typed, never a tier) has no `tiers` of its
// own -- synthesize one so the ladder still reflects its real prices
// instead of coming back empty.
function effectiveTiers(row: any): { minQty: number; price: number }[] {
  if (Array.isArray(row.tiers) && row.tiers.length) return row.tiers;
  const synthesized: { minQty: number; price: number }[] = [];
  if (row.retail != null) synthesized.push({ minQty: 1, price: Number(row.retail) });
  if (row.wholesale != null && Number(row.pack_qty) > 0) synthesized.push({ minQty: Number(row.pack_qty), price: Number(row.wholesale) });
  return synthesized;
}

// ---------------------------------------------------------------------
// New here, not a copy of anything.

// The best row to quote from, INCLUDING out-of-stock ones as a last
// resort. pickBestPriceRow drops them, which is right when the answer is
// going to be charged — but a customer looking at a shelf they cannot
// buy from today is better served by "Ridge nails, 11,400 a kg, out of
// stock just now" than by the item vanishing from the list. Whether it
// can actually be bought is said separately, by availabilityOf().
function quotableRow(rows: any[]): any | null {
  return pickBestPriceRow(rows) || (rows.length ? pickBestPriceRow(rows.map((r) => ({ ...r, out_of_stock: false }))) : null);
}

// In stock, orderable, or neither. Deliberately three words and no date:
// a delivery date on a line this shop does not hold is a promise made
// with somebody else's lorry.
function availabilityOf(rows: any[], onShelf: number): "in-stock" | "to-order" | "out" {
  if (onShelf > 0) return "in-stock";
  return pickBestPriceRow(rows) ? "to-order" : "out";
}

// What we last charged THIS customer for THIS item, keyed
// productId::variantIdx.
//
// Matched on the NORMALISED PHONE, which is where this parts company with
// index.html's lastPriceToClient(): that one matches q.client.name, and a
// name match would hand "Nakato Grace" the price history of "Nakato Grace
// Ltd". The admin app has a human reading the screen who would notice; a
// portal answering by itself at ten at night does not.
//
// Only an explicit sellPrice counts. quoteItemSellPrice() in the admin app
// falls back to re-deriving a sell price from the line's `price` — which
// is cost — and re-deriving anything from cost inside this boundary is
// exactly the code path that must not exist here. A line with no sellPrice
// simply has no memory, which shows up as today's price.
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

// THE ONE NUMBER A CUSTOMER IS OWED.
//
// Today's price is the shop's own markup rule applied to this quantity's
// tier — the same figure the admin quote builder shows. A remembered
// price then leads, subject to two bounds:
//
//   · never below today's cost. No promise is worth selling at a loss,
//     and this is the rule the admin app already enforces.
//
//   · NEVER ABOVE today's price. This bound does not exist in the admin
//     app, and it has to exist here. There, "the remembered price leads"
//     is a recommendation to a person who can see both numbers and
//     override; here it would be an automatic decision to charge a
//     returning customer more than a stranger walking in off the street
//     would pay, at ten at night, with nobody watching. A portal built to
//     earn trust cannot have that in it.
//
// Returns cost so the caller can apply the floor. Cost never leaves this
// function's caller either — see the response builders.
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

// Every quantity breakpoint this row has, each priced the way a real
// order at exactly that quantity would be. Lets one screen show the whole
// curve — "cheaper by the bag from 25kg" — without a second request per
// quantity, and without ever sending a cost.
function customerPriceLadder(product: any, row: any, dflt: any, held: { price: number; at: string } | null) {
  const minQtys = Array.from(
    new Set<number>([1, ...effectiveTiers(row).map((t) => Number(t.minQty))]),
  ).filter((q) => q > 0).sort((a, b) => a - b);
  return minQtys.map((minQty) => {
    const r = customerUnitPrice(product, row, minQty, dflt, held);
    return r ? { minQty, unitPrice: r.unitPrice } : null;
  }).filter((x) => x != null) as { minQty: number; unitPrice: number }[];
}

// ---------------------------------------------------------------------
// What goes with what
//
// 0090 is the shop's own sentence: "Iron sheets NEEDS roofing nails, 8
// per sheet." The ratio is the whole value — without it a suggestion can
// only name a thing, and with it the portal can say 140 sheets means
// about 1,120 nails, which is what a hardware man says and what an advert
// never does. It is also the one thing a single supplier cannot do: it
// turns a line into a list.
//
// The rules below are index.html's, followed rather than copied — its
// versions return admin-shaped rows and read from `data`. Three of them
// are load-bearing and each is pinned by test:
//
//   · A SENTENCE IS TRUE FROM BOTH ENDS, so a pairing written on the
//     other product about this one counts too.
//   · THE FIGURE DOES NOT SURVIVE THE TURN. "8 nails per sheet" says
//     nothing about how many sheets go with a nail, so a reversed pairing
//     carries no ratio at all.
//   · NO RATIO, NO FIGURE. An invented quantity is worse than none.
//
// Never crossing: product_links.note, which is the shop's own note to
// itself and can say anything at all.
// ---------------------------------------------------------------------

const ADVICE_VERBS: Record<string, number> = { needs: 0, part: 1, with: 2 };
// 'instead' is a substitute — a different feature, for when something
// cannot be had. 'after' is about when a thing runs out, which is the
// shop's reordering business and not a companion at all.
const ADVICE_MAX = 3;

function sizeIdx(v: unknown): number | null {
  return (v == null || v === "" || isNaN(Number(v))) ? null : Number(v);
}

// Every pairing that applies to one basket line, read from both ends and
// said once. Mirrors index.html's pairingsFor.
function pairingsFor(links: any[], productId: string, variantIdx: number | null) {
  const vi = sizeIdx(variantIdx);
  const live = (links || []).filter((l) => l.active !== false && ADVICE_VERBS[l.verb] != null);
  const fits = (l: any) => sizeIdx(l.fromVariantIdx) == null || sizeIdx(l.fromVariantIdx) === vi;

  const mine = live.filter((l) => l.fromId === productId).filter(fits);
  const said = new Set(mine.map((l) => l.verb + " " + l.toId));
  live.filter((l) => l.toId === productId && l.fromId !== productId)
    .map((l) => {
      const rev = REVERSE[l.verb];
      if (!rev) return null;
      return {
        fromId: l.toId, fromVariantIdx: sizeIdx(l.toVariantIdx),
        toId: l.fromId, toVariantIdx: sizeIdx(l.fromVariantIdx),
        verb: rev,
        // The figure does not survive the turn.
        qty: null, per: "", active: l.active,
      };
    })
    .filter((l) => l && fits(l) && !said.has(l!.verb + " " + l!.toId))
    .forEach((l) => mine.push(l));

  // The most specific rule for each pairing wins: one written at this
  // size, else one naming a size on the other side, else the general one.
  const byRule = new Map<string, any[]>();
  mine.forEach((l) => {
    const k = l.verb + " " + l.toId;
    if (!byRule.has(k)) byRule.set(k, []);
    byRule.get(k)!.push(l);
  });
  const out: any[] = [];
  byRule.forEach((rows) => {
    const atSize = vi != null ? rows.filter((l) => sizeIdx(l.fromVariantIdx) === vi) : [];
    if (atSize.length) { out.push(...atSize); return; }
    const named = rows.filter((l) => sizeIdx(l.fromVariantIdx) == null && sizeIdx(l.toVariantIdx) != null);
    if (named.length) { out.push(...named); return; }
    out.push(...rows.filter((l) => sizeIdx(l.fromVariantIdx) == null && sizeIdx(l.toVariantIdx) == null));
  });
  return out;
}

const REVERSE: Record<string, string> = { needs: "with", with: "with", part: "part" };

// ---------------------------------------------------------------------
// The statement
//
// Mirrors index.html's customerStatementRows: same sort, same opening
// collapse, same running balance, same self-check. A customer's statement
// that disagreed with the shop's own screen would be worse than none.
// ---------------------------------------------------------------------

const STATEMENT_MONTHS = 6;

// The invoice this row belongs to, and ONLY where the app wrote the note
// itself. index.html's debtLogIsInvoiceOwned recognises its own
// auto-generated note by this exact prefix; anything else in that field
// was typed by the shop into a box nobody told them a customer would
// read, and it stays where it was typed.
function statementRef(note: unknown): string {
  const m = /^Auto-sync — (INV-\d+)/.exec(String(note ?? ""));
  return m ? m[1] : "";
}

export function buildStatement(log: any[], fromISO: string, toISO: string, recorded: number) {
  // Sorted by date, then by the order they were written. Two entries on
  // one day have no other way to be ordered, and a running balance that
  // reorders them shows a customer a sequence that never happened.
  const rows0 = (log || []).slice().sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")) || ((a.id || 0) - (b.id || 0)));

  const delta = (e: any) => e.type === "charge" ? (Number(e.amount) || 0) : -(Number(e.amount) || 0);

  // Everything before the period collapses into one opening figure,
  // rather than reprinting months the customer has already been sent.
  let opening = 0;
  rows0.forEach((e) => { if (String(e.date || "") < fromISO) opening += delta(e); });

  let running = opening;
  const rows = rows0
    .filter((e) => { const d = String(e.date || ""); return d >= fromISO && d <= toISO; })
    .map((e) => {
      running += delta(e);
      return {
        date: e.date || "",
        type: e.type === "charge" ? "charge" : "payment",
        charge: e.type === "charge" ? (Number(e.amount) || 0) : 0,
        payment: e.type === "charge" ? 0 : (Number(e.amount) || 0),
        balance: running,
        ref: statementRef(e.note),
      };
    });

  return {
    opening, rows, closing: running,
    charged: rows.reduce((s, r) => s + r.charge, 0),
    paid: rows.reduce((s, r) => s + r.payment, 0),
    /* The one check this document can make on itself. The log is a
       history and the balance is kept alongside it; nothing forces them
       to agree, and a statement that quietly disagrees with what the shop
       will chase for is worse than one that admits it. */
    agrees: Math.abs(running - recorded) < 1,
  };
}

// ---------------------------------------------------------------------
// Where an order has reached
//
// The shop's own board (SQ_STATUS_ORDER in index.html) is the authority,
// and this list has to be the same list in the same order — a portal that
// invented a sixth stage, or ordered these differently, would show a
// customer a journey their order is not on. test/client-orders.test.js
// reads the ladder out of index.html and compares.
//
// The customer's WORDS are not here. They are on the page, with the rest
// of the copy; what crosses is the key and the order.
// ---------------------------------------------------------------------
const ORDER_STAGES = ["draft", "awaiting_goods", "preparing", "pending_delivery", "completed"];

function stageOf(status: unknown): string {
  const s = String(status || "draft");
  return ORDER_STAGES.indexOf(s) >= 0 ? s : "draft";
}

// What a customer was actually charged for one saved order. Reads
// sellPrice and nothing else: `price` on the same line is what the shop
// paid its supplier, and it has no business on this side of the wire.
function orderLines(payload: any) {
  const items = payload && payload.items;
  if (!Array.isArray(items)) return [];
  return items.map(function (it: any) {
    const qty = Number(it && it.qty) || 0;
    const sell = Number(it && it.sellPrice) || 0;
    return {
      name: (it && it.productName) || "",
      variantLabel: (it && it.variantLabel) || "",
      qty,
      unit: (it && it.unit) || "",
      unitPrice: sell,
      lineTotal: qty * sell,
    };
  });
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
        // A LIVE PIN IS NEVER REPLACED. Two reasons, and the first is the
        // one that makes the shop workable: client-accounts issues a PIN
        // an admin reads out to a customer, and if the customer's first
        // tap on this screen minted a second one, the figures they were
        // just given would be dead before they typed them.
        //
        // The second is that re-minting on demand is the rotation attack
        // the ceiling above exists to stop. Once a PIN is spent — used,
        // expired, or its three tries gone — there is nothing to protect
        // and a new one may be minted; while it is live there is.
        //
        // The old guard here compared pin_expires_at against
        // `now - PIN_TTL + START_WINDOW`, which is the sign inverted: it
        // suppressed minting for a PIN issued up to NINETEEN minutes ago,
        // including one that had already expired, so a customer whose PIN
        // ran out tapped "Ask for another" and got a cheerful reply and no
        // PIN for the next nine minutes.
        const live = account.pin_hash
          && account.pin_expires_at
          && Date.parse(account.pin_expires_at) > Date.now()
          && (account.pin_attempts || 0) < PIN_MAX_ATTEMPTS;
        // Nothing is minted while the ceiling is hit either, PIN live or
        // not: a new PIN here would carry the old attempt count anyway and
        // be unusable, and minting one would be this endpoint quietly
        // pretending it had helped.
        const locked = (account.pin_attempts || 0) >= PIN_MAX_ATTEMPTS;
        if (!live && !locked) {
          const pin = mintPin();
          await admin.from("client_accounts").update({
            pin_hash: await hashPin(pin, shopId, account.customer_id),
            pin_expires_at: new Date(Date.now() + PIN_TTL_MS).toISOString(),
            // pin_attempts is deliberately NOT reset. See PIN_MAX_ATTEMPTS.
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
        // Names the only thing that actually helps. "Ask for a new PIN"
        // was advice this endpoint had stopped taking: start will not mint
        // past the ceiling, so the customer would have tapped it and
        // waited for a PIN that was never coming.
        return json({ error: "Too many wrong tries. Ring the shop for a new PIN." }, 429);
      }

      const ok = safeEqual(account.pin_hash, await hashPin(pin, shopId, account.customer_id));
      if (!ok) {
        const attempts = (account.pin_attempts || 0) + 1;
        await admin.from("client_accounts").update({ pin_attempts: attempts })
          .eq("shop_id", shopId).eq("customer_id", account.customer_id);
        return json({
          error: "That PIN is not right",
          triesLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
        }, 401);
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

      /* NO STATUS FILTER, and that is deliberate rather than an omission.
         A saved_quotes row IS an order in this app — status is how far
         along it is (draft → awaiting_goods → preparing →
         pending_delivery → completed), not whether it counts. The admin
         app's own customerPurchaseHistory and lastPriceToClient filter on
         nothing but `voided`, and this has to agree with them or a
         customer's portal shows a different history from the one the shop
         is looking at.

         This read used to carry .eq("status", "order"). There is no such
         status anywhere in this app — it was invented here — so it matched
         zero rows, and every customer saw "Nothing here yet" however much
         they had bought. The same filter was on the pricing read, so no
         remembered price was ever found either. Both features were dead
         from the day they shipped and looked perfectly well in review. */
      const [{ data: customer }, { data: debtRows }, { data: quotes }] = await Promise.all([
        admin.from("customers")
          .select("name, phone, debt, terms_days, credit_limit")
          .eq("shop_id", shopId).eq("id", customerId).maybeSingle(),
        admin.from("customer_debt_log")
          .select("date, type, amount").eq("shop_id", shopId).eq("customer_id", customerId),
        admin.from("saved_quotes")
          .select("id, client_name, client_phone, date, status, invoiced, voided, amount_paid, payload")
          .eq("shop_id", shopId).eq("voided", false)
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

    // -----------------------------------------------------------------
    // catalogue / price — what we stock, and what it costs THEM
    //
    // Both need a session. That is the whole strategy in one line: there
    // is no price on this endpoint without a verified account, and the
    // price there is belongs to that account.
    //
    // COLUMNS ARE NAMED, NOT STARRED. agent-catalog reads prices with
    // select("*") and hand-picks fields on the way out, which is one edit
    // away from a leak. Here the supplier columns are never fetched at
    // all: supplier_id, supplier_sku and price_source are not in the
    // select, so they are not in memory, so no future spread of a row
    // could carry them. The redaction is done by the query.
    // -----------------------------------------------------------------
    if (action === "catalogue" || action === "price") {
      const session = await sessionAccount(shopId, String(body.token ?? ""));
      if (!session) return json({ error: "Sign in again" }, 401);
      const customerId = session.customer_id;

      const PRICE_COLS = "product_id, variant_idx, wholesale, retail, pack_qty, unit, pack_unit, tiers, out_of_stock";
      const PRODUCT_COLS = "id, name, image, category, subcategory, short_description, variants, "
        + "wholesale_markup_type, wholesale_markup_value, retail_markup_type, retail_markup_value";

      const [{ data: settingsRow }, { data: customer }] = await Promise.all([
        admin.from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle(),
        admin.from("customers").select("phone").eq("shop_id", shopId).eq("id", customerId).maybeSingle(),
      ]);
      if (!customer) return json({ error: "Sign in again" }, 401);
      const presets = settingsRow?.presets || {};
      const defaultMarkup = presets.defaultMarkup || null;
      const mine = normalisePhone(customer.phone);

      // Their own past orders, for the remembered price. Never anybody
      // else's: the filter lives in rememberedPrices and is the same
      // normalised-phone match the account action uses.
      const { data: quotes } = await admin.from("saved_quotes")
        .select("client_phone, date, voided, payload")
        .eq("shop_id", shopId).eq("voided", false)
        .order("id", { ascending: false }).limit(200);
      const held = rememberedPrices(quotes || [], mine);

      if (action === "price") {
        const productId = String(body.productId ?? "");
        const variantIdx = body.variantIdx == null || body.variantIdx === "" ? null : Number(body.variantIdx);
        const qty = Number(body.qty ?? 1);
        if (!productId || !(qty > 0)) return json({ error: "productId and a quantity are required" }, 400);

        // prices.variant_idx stores a real SQL NULL for a non-variant
        // product, so .is() and .eq() have to be picked per case or a
        // non-variant product's rows silently match nothing.
        let q = admin.from("prices").select(PRICE_COLS).eq("shop_id", shopId).eq("product_id", productId);
        q = variantIdx == null ? q.is("variant_idx", null) : q.eq("variant_idx", String(variantIdx));
        const [{ data: product }, { data: rows }, { data: stockRow }] = await Promise.all([
          admin.from("products").select(PRODUCT_COLS).eq("shop_id", shopId).eq("id", productId).maybeSingle(),
          q,
          admin.from("stock").select("qty").eq("shop_id", shopId)
            .eq("key", productId + (variantIdx == null ? "" : "::" + variantIdx)).maybeSingle(),
        ]);
        if (!product) return json({ error: "We do not have that item" }, 404);

        const row = quotableRow(rows || []);
        const availability = availabilityOf(rows || [], Number(stockRow?.qty) || 0);
        const key = productId + "::" + (variantIdx == null ? "" : String(variantIdx));
        const priced = row ? customerUnitPrice(product, row, qty, defaultMarkup, held[key] || null) : null;
        if (!priced) return json({ ok: true, available: false, availability });

        // Built key by key, and cost is simply not among the keys. There
        // is no destructure to get wrong, because nothing is spread.
        return json({
          ok: true,
          available: true,
          availability,
          unitPrice: priced.unitPrice,
          heldFrom: priced.heldFrom,
          qty,
          unit: priced.unit,
          packUnit: priced.packUnit,
          packQty: priced.packQty,
          tiers: customerPriceLadder(product, row, defaultMarkup, held[key] || null),
        });
      }

      // action === "catalogue"
      const [{ data: products }, { data: rows }, { data: stockRows }] = await Promise.all([
        admin.from("products").select(PRODUCT_COLS).eq("shop_id", shopId),
        admin.from("prices").select(PRICE_COLS).eq("shop_id", shopId),
        admin.from("stock").select("key, qty").eq("shop_id", shopId),
      ]);

      const byKey = new Map<string, any[]>();
      (rows || []).forEach((r: any) => {
        const k = `${r.product_id}::${r.variant_idx == null ? "" : r.variant_idx}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(r);
      });
      const onShelf: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => { onShelf[r.key] = Number(r.qty) || 0; });

      const items = (products || []).flatMap((p: any) => {
        const variants = Array.isArray(p.variants) ? p.variants : [];
        const idxs: (number | null)[] = variants.length ? variants.map((_: any, i: number) => i) : [null];
        return idxs.map((variantIdx) => {
          const key = `${p.id}::${variantIdx == null ? "" : variantIdx}`;
          const mineRows = byKey.get(key) || [];
          const row = quotableRow(mineRows);
          const shelf = onShelf[p.id + (variantIdx == null ? "" : "::" + variantIdx)] || 0;
          const priced = row ? customerUnitPrice(p, row, 1, defaultMarkup, held[key] || null) : null;
          // The one cheaper breakpoint worth teasing, so a list of
          // hundreds does not carry a whole ladder per row. The item's
          // own screen asks for the full one.
          let nextMinQty: number | null = null, nextPrice: number | null = null;
          if (row) {
            const ladder = customerPriceLadder(p, row, defaultMarkup, held[key] || null);
            const cheapest = ladder.length > 1
              ? ladder.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a))
              : null;
            if (cheapest && priced && cheapest.unitPrice < priced.unitPrice) {
              nextMinQty = cheapest.minQty;
              nextPrice = cheapest.unitPrice;
            }
          }
          const v = variantIdx != null ? variants[variantIdx] : null;
          return {
            productId: p.id,
            variantIdx,
            name: p.name,
            variantLabel: v ? Object.values(v.combo || {}).join(" / ") : "",
            /* `description`, not `note`. The content is safe — it is the
               product's own short description, the same line the printed
               catalogue carries — but the NAME collided with the two
               fields in this schema that must never cross:
               product_links.note and customer_debt_log.note. A field
               called note in a customer's reply is one careless edit from
               being filled with one of them, and the rule that no reply
               may carry a key called note is worth more than the word. */
            description: p.short_description || "",
            category: p.category || "",
            subcategory: p.subcategory || "",
            image: (v && v.image) || p.image || null,
            available: !!priced,
            availability: availabilityOf(mineRows, shelf),
            unitPrice: priced ? priced.unitPrice : null,
            heldFrom: priced ? priced.heldFrom : null,
            unit: priced ? priced.unit : "",
            packUnit: priced ? priced.packUnit : "",
            packQty: priced ? priced.packQty : 0,
            nextMinQty,
            nextPrice,
          };
        });
      });

      return json({ ok: true, items });
    }

    // -----------------------------------------------------------------
    // advice — what this order still needs
    //
    // The highest-value thing in the whole project, and the reason is
    // commercial rather than technical: a customer who can be told "140
    // sheets takes about 1,120 nails" is buying a LIST, and a list is the
    // one thing a single supplier cannot fill. Every other defence in the
    // portal buys time; this is what the time is for.
    //
    // Takes the basket, not one item, because the useful sentence is
    // about the ORDER — "you have none on this order" can only be said by
    // something that can see all of it.
    // -----------------------------------------------------------------
    if (action === "advice") {
      const session = await sessionAccount(shopId, String(body.token ?? ""));
      if (!session) return json({ error: "Sign in again" }, 401);
      const lines = Array.isArray(body.items) ? body.items : [];
      if (!lines.length) return json({ ok: true, advice: [] });

      // 0090 and 0093 are hand-applied like everything else here. A shop
      // without them has written nothing down about what goes with what,
      // which is exactly what it knew yesterday — so this comes back
      // empty rather than failing the basket screen it sits on. The
      // variant columns are probed by retrying without them, so a shop
      // with 0090 and not 0093 still gets its general pairings.
      const LINK_COLS = "from_id, verb, to_id, qty, per, active";
      let linkRows: any[] | null = null;
      {
        const withSizes = await admin.from("product_links")
          .select(LINK_COLS + ", from_variant_idx, to_variant_idx").eq("shop_id", shopId);
        if (!withSizes.error) linkRows = withSizes.data;
        else {
          const plain = await admin.from("product_links").select(LINK_COLS).eq("shop_id", shopId);
          linkRows = plain.error ? null : plain.data;
        }
      }
      if (!linkRows || !linkRows.length) return json({ ok: true, advice: [] });
      // note is deliberately not in either column list: it is the shop's
      // own note to itself and can say anything at all.
      const links = linkRows.map((r: any) => ({
        fromId: r.from_id, toId: r.to_id, verb: r.verb,
        qty: r.qty == null ? null : Number(r.qty), per: r.per || "",
        active: r.active, fromVariantIdx: r.from_variant_idx, toVariantIdx: r.to_variant_idx,
      }));

      const inBasket = new Set(lines.map((l: any) =>
        String(l.productId) + "::" + (l.variantIdx == null || l.variantIdx === "" ? "" : String(Number(l.variantIdx)))));
      const basketProducts = new Set(lines.map((l: any) => String(l.productId)));

      // Every companion the basket calls for, merged: two lines that both
      // need nails need one quantity of nails between them, not two
      // suggestions of the same thing.
      const wanted = new Map<string, any>();
      for (const line of lines as any[]) {
        const fromId = String(line.productId);
        const fromVi = line.variantIdx == null || line.variantIdx === "" ? null : Number(line.variantIdx);
        const fromQty = Number(line.qty) || 0;
        if (!fromQty) continue;
        for (const l of pairingsFor(links, fromId, fromVi)) {
          if (l.toId === fromId) continue;
          if (basketProducts.has(l.toId)) continue;
          const toVi = sizeIdx(l.toVariantIdx);
          const key = l.toId + "::" + (toVi == null ? "" : String(toVi));
          if (inBasket.has(key)) continue;
          // The rule's ratio times the line — eight nails a sheet against
          // a hundred and forty sheets. No ratio, no figure.
          const want = l.qty ? Math.max(1, Math.round(Number(l.qty) * fromQty)) : null;
          const seen = wanted.get(key);
          const because = { name: "", qty: fromQty, ratioQty: l.qty ?? null, ratioPer: l.per || "" };
          if (!seen) {
            wanted.set(key, { toId: l.toId, toVariantIdx: toVi, verb: l.verb, qty: want, because: [because], fromIds: [fromId] });
          } else {
            // Strongest verb wins the ordering; the quantities add up.
            if (ADVICE_VERBS[l.verb] < ADVICE_VERBS[seen.verb]) seen.verb = l.verb;
            seen.qty = want == null ? seen.qty : (seen.qty == null ? want : seen.qty + want);
            seen.because.push(because);
            seen.fromIds.push(fromId);
          }
        }
      }
      if (!wanted.size) return json({ ok: true, advice: [] });

      const ids = [...new Set([...wanted.values()].map((w) => w.toId).concat([...basketProducts]))];
      const PRICE_COLS = "product_id, variant_idx, wholesale, retail, pack_qty, unit, pack_unit, tiers, out_of_stock";
      const PRODUCT_COLS = "id, name, image, variants, "
        + "wholesale_markup_type, wholesale_markup_value, retail_markup_type, retail_markup_value";
      const [{ data: settingsRow }, { data: customer }, { data: products }, { data: priceRows }, { data: stockRows }] =
        await Promise.all([
          admin.from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle(),
          admin.from("customers").select("phone").eq("shop_id", shopId).eq("id", session.customer_id).maybeSingle(),
          admin.from("products").select(PRODUCT_COLS).eq("shop_id", shopId).in("id", ids),
          admin.from("prices").select(PRICE_COLS).eq("shop_id", shopId).in("product_id", ids),
          admin.from("stock").select("key, qty").eq("shop_id", shopId),
        ]);
      if (!customer) return json({ error: "Sign in again" }, 401);
      const defaultMarkup = (settingsRow?.presets || {}).defaultMarkup || null;
      const mine = normalisePhone(customer.phone);
      const { data: quotes } = await admin.from("saved_quotes")
        .select("client_phone, date, voided, payload")
        .eq("shop_id", shopId).eq("voided", false)
        .order("id", { ascending: false }).limit(200);
      const held = rememberedPrices(quotes || [], mine);

      const productsById = new Map<string, any>((products || []).map((p: any) => [p.id, p]));
      const rowsByKey = new Map<string, any[]>();
      (priceRows || []).forEach((r: any) => {
        const k = `${r.product_id}::${r.variant_idx == null ? "" : r.variant_idx}`;
        if (!rowsByKey.has(k)) rowsByKey.set(k, []);
        rowsByKey.get(k)!.push(r);
      });
      const onShelf: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => { onShelf[r.key] = Number(r.qty) || 0; });
      const nameOf = (id: string) => (productsById.get(id) || {}).name || "";

      const advice: any[] = [];
      for (const w of wanted.values()) {
        const product = productsById.get(w.toId);
        // A pairing names two products by id and neither has to still
        // exist — 0090 keeps to_id out of the foreign keys on purpose, so
        // a shop can pair cement with sand it does not sell. A row that
        // no longer resolves simply never reaches a customer.
        if (!product) continue;
        const variants = Array.isArray(product.variants) ? product.variants : [];
        // A product with sizes and no size named is a suggestion nobody
        // can act on: offering "iron sheets" where there are five colours
        // and the shop has not said which is offering nothing.
        if (variants.length && w.toVariantIdx == null) continue;
        const key = w.toId + "::" + (w.toVariantIdx == null ? "" : String(w.toVariantIdx));
        const rows = rowsByKey.get(key) || [];
        const row = quotableRow(rows);
        if (!row) continue;
        const priced = customerUnitPrice(product, row, w.qty || 1, defaultMarkup, held[key] || null);
        if (!priced) continue;
        const v = w.toVariantIdx != null ? variants[w.toVariantIdx] : null;
        advice.push({
          productId: w.toId,
          variantIdx: w.toVariantIdx,
          name: product.name,
          variantLabel: v ? Object.values(v.combo || {}).join(" / ") : "",
          image: (v && v.image) || product.image || null,
          verb: w.verb,
          qty: w.qty,
          unit: priced.unit,
          unitPrice: priced.unitPrice,
          availability: availabilityOf(rows, onShelf[w.toId + (w.toVariantIdx == null ? "" : "::" + w.toVariantIdx)] || 0),
          // The reason, in parts, so the sentence is written where the
          // rest of the customer's words are. Names only the two products
          // and the shop's own ratio.
          because: w.because.map((b: any, i: number) => ({
            name: nameOf(w.fromIds[i]), qty: b.qty, ratioQty: b.ratioQty, ratioPer: b.ratioPer,
          })).filter((b: any) => b.name),
        });
      }

      // Needs before part before with; a suggestion carrying a real
      // quantity before one that can only name a thing.
      advice.sort((a, b) =>
        (ADVICE_VERBS[a.verb] - ADVICE_VERBS[b.verb])
        || ((a.qty == null ? 1 : 0) - (b.qty == null ? 1 : 0))
        || String(a.name).localeCompare(String(b.name)));
      return json({ ok: true, advice: advice.slice(0, ADVICE_MAX) });
    }

    // -----------------------------------------------------------------
    // statement — every charge and payment, and what they come to
    //
    // The same document customerStatementRows builds for the shop's own
    // screen, computed the same way and from the same table, because a
    // customer's statement disagreeing with the shop's is worse than no
    // statement at all. Nothing here is derived that is not derived
    // there: an opening figure, a running balance, and the one check the
    // document makes on itself.
    //
    // THE NOTE DOES NOT CROSS, except where the app wrote it. Free text
    // on a debt-log row is the shop's own, typed into a field nobody ever
    // told them a customer would read — so publishing what is in there
    // today would publish remarks made in private. What does cross is the
    // invoice reference out of the app's OWN generated note, recognised
    // by the same test index.html uses for it (debtLogIsInvoiceOwned).
    // That is the line a customer needs to reconcile against their book,
    // and the shop did not write it.
    // -----------------------------------------------------------------
    if (action === "statement") {
      const session = await sessionAccount(shopId, String(body.token ?? ""));
      if (!session) return json({ error: "Sign in again" }, 401);
      const customerId = session.customer_id;

      const to = new Date().toISOString().slice(0, 10);
      // Built from the year and month, never by subtracting months from
      // the date: standing on the 31st, month - 6 asks for the 31st of a
      // 30-day month and rolls into the next one. The same note
      // customerStatementRange carries, for the same reason.
      const d = new Date(to + "T00:00:00Z");
      const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - STATEMENT_MONTHS, 1))
        .toISOString().slice(0, 10);

      const [{ data: customer }, { data: log }] = await Promise.all([
        admin.from("customers").select("name, debt").eq("shop_id", shopId).eq("id", customerId).maybeSingle(),
        admin.from("customer_debt_log").select("id, date, type, amount, note")
          .eq("shop_id", shopId).eq("customer_id", customerId),
      ]);
      if (!customer) return json({ error: "Sign in again" }, 401);

      const built = buildStatement(log || [], from, to, Number(customer.debt) || 0);
      return json({
        ok: true,
        name: customer.name || "",
        from, to,
        opening: built.opening,
        rows: built.rows,
        closing: built.closing,
        charged: built.charged,
        paid: built.paid,
        // What the shop will actually chase for. The headline figure on
        // this screen, and the same one the account screen shows.
        owed: Number(customer.debt) || 0,
        agrees: built.agrees,
      });
    }

    // -----------------------------------------------------------------
    // orders / order — the whole record, and one of them
    //
    // The account screen shows five and says how many there are. This is
    // the rest. A CANCELLED order is in it: a customer wondering where an
    // order went is owed the answer "we cancelled it", and leaving it out
    // of the record so the list looks tidier is how they end up ringing
    // to ask. It is marked, and it counts towards nothing.
    // -----------------------------------------------------------------
    if (action === "orders" || action === "order") {
      const session = await sessionAccount(shopId, String(body.token ?? ""));
      if (!session) return json({ error: "Sign in again" }, 401);

      const { data: customer } = await admin.from("customers")
        .select("phone").eq("shop_id", shopId).eq("id", session.customer_id).maybeSingle();
      if (!customer) return json({ error: "Sign in again" }, 401);
      const mine = normalisePhone(customer.phone);
      if (!mine) return json({ ok: true, orders: [], count: 0 });

      // voided is NOT filtered out here, unlike everywhere else in this
      // file: this is the record rather than the reckoning. Every other
      // read — the balance, the remembered price, the recent five — drops
      // them, and must.
      const { data: rows } = await admin.from("saved_quotes")
        .select("id, client_phone, date, status, invoiced, invoiced_at, voided, amount_paid, payload")
        .eq("shop_id", shopId)
        .order("id", { ascending: false }).limit(400);
      const ours = (rows || []).filter((q: any) => normalisePhone(q.client_phone) === mine);

      if (action === "order") {
        const wanted = String(body.orderId ?? "");
        const q = ours.find((r: any) => String(r.id) === wanted);
        // Said the same way whether the order belongs to somebody else or
        // does not exist: a portal that distinguishes them is a portal
        // that will confirm another customer's order number.
        if (!q) return json({ error: "We cannot find that order" }, 404);
        const lines = orderLines(q.payload);
        // NOT the sum of the lines. An order carries charges and, where
        // terms were taken, what the credit costs — and the invoice, the
        // receipt and the debt log are all drawn from the figure that
        // includes them. A customer reading a smaller one here would be
        // reading a number nothing else in the shop agrees with.
        const total = orderTotal(q.payload);
        const paid = Number(q.amount_paid) || 0;
        return json({
          ok: true,
          order: {
            id: q.id,
            date: q.date,
            stage: stageOf(q.status),
            stages: ORDER_STAGES,
            cancelled: !!q.voided,
            invoiced: !!q.invoiced,
            invoicedAt: q.invoiced_at || null,
            // Only where the shop's own books can derive it. There is no
            // record anywhere of when a status changed, so the ladder gets
            // dates for the two moments that ARE written down and none at
            // all for the rest. A promised day the books cannot derive is
            // the one thing this screen must not invent.
            sentAt: (q.payload && q.payload.savedAt) || null,
            deliverTo: (q.payload && q.payload.deliverTo) || null,
            fromPortal: !!(q.payload && q.payload.originPortal),
            lines,
            goods: goodsTotal(q.payload),
            charges: chargeLines(q.payload),
            credit: creditLine(q.payload),
            // Named rather than dropped: a line the shop never priced
            // counts as nothing above, and the screen says so instead of
            // showing a total that is quietly short.
            unpriced: unpricedLines(q.payload),
            total,
            paid,
            due: Math.max(0, total - paid),
          },
        });
      }

      return json({
        ok: true,
        stages: ORDER_STAGES,
        count: ours.length,
        orders: ours.map((q: any) => {
          const lines = orderLines(q.payload);
          return {
            id: q.id,
            date: q.date,
            items: lines.length,
            total: orderTotal(q.payload),
            stage: stageOf(q.status),
            cancelled: !!q.voided,
            invoiced: !!q.invoiced,
            fromPortal: !!(q.payload && q.payload.originPortal),
          };
        }),
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
