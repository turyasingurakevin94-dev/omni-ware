// Receives everything WhatsApp has to say to the shop: customer
// messages, echoes of what the shop sends from its own phone
// (coexistence mirrors both directions through here), and delivery
// statuses for replies sent from the admin.
//
// Deployed with verify_jwt=false out of necessity -- Meta cannot present
// a Supabase JWT -- and protected instead the way Meta specifies:
//   GET  is the subscription handshake, gated on WHATSAPP_VERIFY_TOKEN.
//   POST is authenticated by the X-Hub-Signature-256 header, an
//        HMAC-SHA256 of the raw body under WHATSAPP_APP_SECRET.
//        Dormant while the secret is unset (same pattern and reasoning
//        as NOTIFY_WORKER_SECRET in notify-worker) so setup can be done
//        in either order -- but until it is set, anyone who finds the
//        URL can write fiction into the inbox, so set it.
//
// ALWAYS ANSWERS 200 to a signed POST, even when a payload makes no
// sense: Meta retries non-200 deliveries for hours and then disables
// the subscription -- a parsing bug must cost one lost event, not the
// whole channel. Errors are logged, never thrown at Meta.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
// Same project-wide secret wa-send uses -- the webhook needs it to send
// the order confirmation back inside the (freshly opened) 24h window.
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const GRAPH_BASE = "https://graph.facebook.com/v23.0";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// HMAC-SHA256 of the raw body, hex, compared against "sha256=<hex>".
// Comparison is constant-time-ish via length check + single pass; the
// value being compared is itself a MAC, so timing leaks reveal nothing
// usable, but there is no reason to be sloppy.
async function validSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice("sha256=".length).toLowerCase();
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// What a human would read of a message, for the conversation list.
// Anything without text becomes a bracketed kind -- "[image]", "[order]"
// -- rather than an empty row that looks like a bug.
// deno-lint-ignore no-explicit-any -- typed loosely on purpose: these two
// parsers are extracted verbatim into the Node test harness, whose type
// stripper handles annotations but not `as` casts with generic commas.
function messageBody(m: any) {
  const type = String(m.type || "");
  if (type === "text") return String((m.text && m.text.body) ?? "");
  const withCaption = m[type];
  if (withCaption && typeof withCaption.caption === "string" && withCaption.caption) {
    return `[${type}] ${withCaption.caption}`;
  }
  return `[${type}]`;
}

type WaEvent =
  | { kind: "in"; waId: string; name: string | null; wamid: string; type: string; body: string | null; payload: unknown; ts: string }
  | { kind: "out"; waId: string; wamid: string; type: string; body: string | null; payload: unknown; ts: string }
  | { kind: "status"; wamid: string; status: string; ts: string };

// One webhook `change` normalised into flat events. Pure, so the test
// suite can hold every mapping to account without an HTTP server.
//
// Coexistence detail that matters: a message the shop sends FROM ITS
// PHONE arrives under `message_echoes`/`smb_message_echoes`, not under
// `messages` -- treating those as inbound would file the shop's own
// words as a customer speaking, and reopen 24-hour windows the customer
// never opened.
// deno-lint-ignore no-explicit-any -- see messageBody
function normalizeChange(value: any) {
  const metadata = value.metadata ?? {};
  const phoneNumberId = metadata.phone_number_id == null ? null : String(metadata.phone_number_id);
  const events: WaEvent[] = [];
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const nameOf = (waId: string) => {
    const c = contacts.find((x: any) => String(x.wa_id ?? "") === waId);
    const profile = (c && c.profile) ?? {};
    return typeof profile.name === "string" && profile.name ? profile.name : null;
  };
  const tsIso = (t: unknown) => {
    const n = Number(t);
    return isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
  };

  for (const m of (Array.isArray(value.messages) ? value.messages : [])) {
    const waId = String(m.from ?? "");
    if (!waId || !m.id) continue;
    events.push({
      kind: "in", waId, name: nameOf(waId), wamid: String(m.id),
      type: String(m.type ?? "unknown"), body: messageBody(m), payload: m, ts: tsIso(m.timestamp),
    });
  }
  const echoes = Array.isArray(value.message_echoes) ? value.message_echoes
    : Array.isArray(value.smb_message_echoes) ? value.smb_message_echoes : [];
  for (const m of echoes) {
    const waId = String(m.to ?? "");
    if (!waId || !m.id) continue;
    events.push({
      kind: "out", waId, wamid: String(m.id),
      type: String(m.type ?? "unknown"), body: messageBody(m), payload: m, ts: tsIso(m.timestamp),
    });
  }
  for (const s of (Array.isArray(value.statuses) ? value.statuses : [])) {
    if (!s.id || !s.status) continue;
    events.push({ kind: "status", wamid: String(s.id), status: String(s.status), ts: tsIso(s.timestamp) });
  }
  return { phoneNumberId, events };
}

// A cart's retailer ids are this app's own stock keys ("P017::0" for a
// variant, "P001" for a simple product) -- minted that way by the
// catalog sync precisely so an order can be walked straight back to the
// product. Pure, so the mapping is testable: every cart line becomes a
// quote line, and a retailer id that matches nothing becomes a NAMED
// unknown line rather than silently vanishing from the order.
// deno-lint-ignore no-explicit-any -- extracted into the Node harness, see messageBody
function waOrderLines(productItems: any, productsById: any) {
  const lines = [];
  for (const it of (Array.isArray(productItems) ? productItems : [])) {
    const rid = String(it.product_retailer_id ?? "");
    const qty = Number(it.quantity) || 0;
    const sell = Number(it.item_price) || 0;
    if (!rid || qty <= 0) continue;
    const sep = rid.indexOf("::");
    const productId = sep === -1 ? rid : rid.slice(0, sep);
    const variantIdx = sep === -1 ? null : Number(rid.slice(sep + 2));
    const product = productsById.get(productId);
    if (!product) {
      lines.push({ productId: null, variantIdx: null,
        productName: `UNKNOWN ITEM (${rid}) — check the catalog`,
        unit: "", packUnit: "", packQty: 0, qty,
        supplierId: null, supplierName: null,
        sellPrice: sell, unknownRetailerId: rid });
      continue;
    }
    const v = variantIdx != null && Array.isArray(product.variants) ? product.variants[variantIdx] : null;
    const combo = v && v.combo ? Object.values(v.combo).join(" / ") : "";
    lines.push({
      productId: product.id,
      variantIdx: variantIdx == null ? null : variantIdx,
      productName: combo ? `${product.name} — ${combo}` : product.name,
      unit: "", packUnit: "", packQty: 0, qty,
      supplierId: null, supplierName: null,
      // The price the CATALOG promised at cart time. The shop honours
      // what it advertised; if the catalog was stale, the admin sees it
      // on the order and rings the customer -- the system does not
      // quietly bill a different number than the customer agreed to.
      sellPrice: sell,
    });
  }
  return lines;
}

async function sendText(phoneNumberId: string, to: string, text: string) {
  if (!ACCESS_TOKEN) return null;
  const resp = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) { console.error("wa-webhook: confirmation send failed", resp.status, result); return null; }
  // deno-lint-ignore no-explicit-any
  return String((result as any)?.messages?.[0]?.id ?? "");
}

// A cart becomes an order in Order tracking, the same server-inserted
// shape agent-submit-order has used in production since the agent app
// shipped: no explicit id (the identity column assigns), the quote JSON
// in payload. originWamid carries the cart's message id so the link
// back to the conversation survives.
// deno-lint-ignore no-explicit-any
async function createWaOrder(shopId: string, phoneNumberId: string, waId: string, name: string | null, order: any, wamid: string) {
  const items = Array.isArray(order?.product_items) ? order.product_items : [];
  if (!items.length) { console.error("wa-webhook: order with no items", wamid); return; }
  // deno-lint-ignore no-explicit-any
  const productIds = [...new Set(items.map((it: any) => {
    const rid = String(it.product_retailer_id ?? "");
    const sep = rid.indexOf("::");
    return sep === -1 ? rid : rid.slice(0, sep);
  }).filter(Boolean))];
  const { data: products, error: prodErr } = await admin.from("products")
    .select("id, name, variants").eq("shop_id", shopId).in("id", productIds);
  if (prodErr) { console.error("wa-webhook: order product lookup failed", prodErr); return; }
  const productsById = new Map((products ?? []).map((p) => [String(p.id), p]));
  const lines = waOrderLines(items, productsById);
  if (!lines.length) { console.error("wa-webhook: order mapped to no lines", wamid); return; }
  const total = lines.reduce((s, l) => s + l.qty * l.sellPrice, 0);
  const clientName = name || `+${waId}`;
  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await admin.from("saved_quotes").insert({
    shop_id: shopId,
    client_name: clientName,
    client_phone: `+${waId}`,
    date: now.slice(0, 10),
    status: "draft",
    invoiced: false,
    voided: false,
    amount_paid: 0,
    payload: {
      client: { name: clientName, phone: `+${waId}` },
      items: lines,
      savedAt: now,
      payments: [],
      customerId: null,
      debtCharged: 0,
      originWa: true,
      originWamid: wamid,
    },
  }).select("id").single();
  if (insErr) { console.error("wa-webhook: order insert failed", insErr); return; }
  console.log("wa-webhook: order", inserted.id, "created from cart", wamid, "-", lines.length, "line(s), total", total);

  const confirmation =
    `Thank you! Your order is in — ${lines.length} item${lines.length === 1 ? "" : "s"}, ` +
    `UGX ${total.toLocaleString("en-UG")}. We'll confirm availability and delivery shortly. ` +
    `Order no. ${inserted.id}.`;
  const outWamid = await sendText(phoneNumberId, waId, confirmation);
  if (outWamid) {
    const { data: conv } = await admin.from("wa_conversations")
      .select("id").eq("shop_id", shopId).eq("wa_id", waId).maybeSingle();
    if (conv) {
      const { error } = await admin.from("wa_messages").insert({
        shop_id: shopId, conversation_id: conv.id, wamid: outWamid,
        direction: "out", msg_type: "text", body: confirmation, status: "sent", sent_at: now,
      });
      if (error) console.error("wa-webhook: confirmation record failed AFTER delivery", error);
      await admin.from("wa_conversations").update({ last_message_at: now }).eq("id", conv.id);
    }
  }
}

/* ---- Auto-quote (phase 4b): exact matches only, by decision. ----

   A MIRROR of the client's waQuoteTokens/waQuoteMatch/waQuoteReply,
   small enough to carry twice; the test suite runs both implementations
   over the same fixtures and fails if they ever disagree -- on the
   match AND on the words.

   IT READS THE QUOTE PACK, not the Meta catalog. That was the fork:
   the catalog takes only products with a photo and a price, so the
   webhook could answer about a few dozen things while the browser could
   answer about hundreds, and the same question got a price by day and
   silence by night. The pack is the browser's own candidate list,
   published to wa_quote_pack -- every product with a price, photo or
   no photo, carrying the words this shop's customers use for it.
   Prices still come from the client's proven chain; the server does not
   and must not re-derive one.

   Anything less than an exact match is left for the humans and the
   inbox card. */
const WA_QUOTE_STOPWORDS = new Set(("how much is the a an of for price cost what whats does do you have i want need me my "
  + "hello hi hey ok okay thanks thank good morning afternoon evening please pls and or in on at to it this that one "
  + "buy get selling sell kwa ya sente ssente meka").split(" "));

// A size is one word: "6*80", "6x80", "6 x 80", "6-80", "M6*80" are the
// same bolt, and none of them is six of anything. Four digits a side
// keeps phone numbers and dates out. Character-for-character the
// client's waQuoteSizeJoin.
function waQuoteSizeJoin(s: string) {
  return String(s || "").toLowerCase()
    .replace(/\bm?(\d{1,4}(?:\.\d+)?)\s*(?:[x×*\/-]|by)\s*(\d{1,4}(?:\.\d+)?)(?!\d)/g, "$1x$2");
}
const WA_QUOTE_SIZE = /^\d+(?:\.\d+)?x\d/;

function waQuoteTokens(str: string) {
  return waQuoteSizeJoin(str)
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !WA_QUOTE_STOPWORDS.has(w));
}

// The same word, said either way -- "nails" and "Nails", "cements" and
// "Cement". Character-for-character the client's waQuoteStem.
function waQuoteStem(w: string) {
  const t = String(w || "").toLowerCase();
  if (t.length < 4 || !t.endsWith("s") || t.endsWith("ss")) return t;
  if (t.length > 4 && /(?:s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2);
  return t.slice(0, -1);
}

// deno-lint-ignore no-explicit-any -- extracted into the Node harness
function waExactMatch(text: string, candidates: any) {
  const qSet = new Set(waQuoteTokens(text).map(waQuoteStem));
  // The words in the message that name SOME product. A number or a
  // greeting is not evidence against a match, so it cannot count
  // against precision.
  const prodTokens: Set<string> = new Set();
  candidates.forEach((c: any) => {
    (c.tokens ?? []).forEach((t: string) => { if (qSet.has(waQuoteStem(t))) prodTokens.add(waQuoteStem(t)); });
    (c.aliases ?? []).forEach((a: string) => { if (qSet.has(waQuoteStem(a))) prodTokens.add(waQuoteStem(a)); });
  });
  // ONLY THE NAMED READING. The client also reads a message by category
  // and by misspelling, so the owner is shown a guess -- but a guess is
  // never sent, and this function exists only to send. Leaving those
  // readings out here is not a divergence; it is the contract.
  let best: number[] | null = null;
  let winners: any[] = [];
  candidates.forEach((c: any) => {
    if (!c.tokens.length) return;
    const said = c.tokens.filter((t: string) => qSet.has(waQuoteStem(t))).length;
    const alias = (c.aliases ?? []).find((a: string) => qSet.has(waQuoteStem(a)));
    // `hit` is the naming -- an alias names the product wholly; while
    // `explains` is what precision asks, how many of the message's own
    // product words this candidate accounts for.
    const hit = alias ? c.tokens.length : said;
    const explains = said + (alias ? 1 : 0);
    if (hit === 0) return;
    const recall = hit / c.tokens.length;
    // No floor, as on the client: how much of THEIR message a product
    // explains ranks first, how much of its name they said second. The
    // whole-name requirement lives in the contract below, not here.
    const rank = [explains, hit, recall];
    const better = !best || rank[0] > best[0]
      || (rank[0] === best[0] && (rank[1] > best[1] || (rank[1] === best[1] && rank[2] > best[2])));
    const same = best && rank[0] === best[0] && rank[1] === best[1] && rank[2] === best[2];
    if (better) { best = rank; winners = [{ c, hit, explains, recall }]; }
    else if (same) winners.push({ c, hit, explains, recall });
  });
  // THE AUTONOMY CONTRACT, and the client holds the identical one: they
  // said the WHOLE name, nothing else they said names another product,
  // and nobody else matched as well. Scoring recall alone let a
  // one-word product answer a question that was mostly about something
  // else -- "cement and iron sheets" came back as a cement quote.
  if (winners.length !== 1) return null;
  const w = winners[0];
  const precision = prodTokens.size ? w.explains / prodTokens.size : 0;
  if (w.recall === 1 && precision === 1) return w.c;
  return null;
}

// How long after it was built a pack may still be quoted from. The
// browser republishes every time the WhatsApp screen is opened and
// anything has changed, so a pack this old means nobody has opened the
// app in a month -- and a price nobody has looked at in a month is not
// a price to say unattended. Silence is the safe direction.
const WA_PACK_STALE_DAYS = 30;

// The published pack, cached per instance: a burst of questions must
// not become a burst of database reads.
// deno-lint-ignore no-explicit-any
let packCache: { shopId: string; at: number; items: any[] } | null = null;

async function quotePackItems(shopId: string) {
  if (packCache && packCache.shopId === shopId && Date.now() - packCache.at < 5 * 60 * 1000) {
    return packCache.items;
  }
  const { data: row, error } = await admin.from("wa_quote_pack")
    .select("items, built_at").eq("shop_id", shopId).maybeSingle();
  if (error) { console.error("wa-webhook: quote pack read failed", error); return null; }
  // NAMED, not silently nothing: a shop that opted in and is answering
  // no one should be findable in the logs.
  if (!row) { console.log("wa-webhook: no quote pack published for shop", shopId, "- not auto-quoting"); return null; }
  const age = (Date.now() - Date.parse(String(row.built_at))) / 86400000;
  if (!(age >= 0) || age > WA_PACK_STALE_DAYS) {
    console.log("wa-webhook: quote pack is", Math.round(age), "days old - not auto-quoting");
    return null;
  }
  const items = Array.isArray(row.items) ? row.items : [];
  packCache = { shopId, at: Date.now(), items };
  return items;
}

// THE SAME WORDS THE OWNER WOULD HAVE SENT. Character-for-character the
// client's waQuoteReply and waAskedQty, which is why they are pure
// functions of a match: one voice, whether the owner taps Send or the
// system answers at midnight. The test suite runs both copies over one
// fixture set.
// deno-lint-ignore no-explicit-any
function waAskedQty(text: string, m: any) {
  const words = waQuoteSizeJoin(text).replace(/[^a-z0-9\u00C0-\u024F.,]+/g, " ").trim().split(/\s+/)
    .filter((w) => /^\d/.test(w));
  // deno-lint-ignore no-explicit-any
  const toks: any[] = (m && m.tokens) || [];
  const nameNums = new Set(toks.filter((t) => /^\d/.test(t)));
  for (const w of words) {
    if (WA_QUOTE_SIZE.test(w)) continue;         // 6x80 is a bolt, not six of anything
    const n = Number(String(w).replace(/[,.]+$/, "").replace(/,/g, ""));
    if (!isFinite(n) || n <= 1) continue;      // "1" is not a quantity worth saying
    if (nameNums.has(String(n))) continue;      // 28 in "28 gauge" is the product
    if (n > 100000) continue;                   // that is a price, or a phone number
    return n;
  }
  return null;
}

// What one unit costs at this quantity -- the cheaper of the retail
// rung and the wholesale side for a pack buyer. Character-for-character
// the client's waQuoteEach.
// deno-lint-ignore no-explicit-any
function waQuoteEach(m: any, qty: number | null) {
  const n = Number(qty);
  if (!isFinite(n) || n <= 1) return { each: m.price, why: null };
  // deno-lint-ignore no-explicit-any
  const breaks: any[] = m.breaks ?? [];
  const brk = breaks.filter((b) => n >= b.qty).sort((x, y) => y.qty - x.qty)[0] || null;
  let each = brk ? brk.price : m.price;
  let why = brk ? `${brk.qty}+` : null;
  if (m.wholesale && m.pack && n >= m.pack.qty && m.wholesale.price < each) {
    each = m.wholesale.price; why = `wholesale, ${m.pack.qty}+`;
  }
  return { each, why };
}

// deno-lint-ignore no-explicit-any
function waQuoteReply(m: any, qty: number | null) {
  const lines: string[] = [];
  // We sell it; the price is pending. Unreachable here -- the pack carries
  // only priced items -- and kept so the two copies stay one function.
  if (m.priced === false || m.price == null) {
    return `${m.name}: we have it — the price will be confirmed shortly.\nReply here to order, or ask about anything else.`;
  }
  lines.push(`${m.name}: UGX ${Number(m.price).toLocaleString("en-UG")}${m.unit ? " per " + m.unit : ""}.`);
  // deno-lint-ignore no-explicit-any
  const breaks: any[] = m.breaks ?? [];
  const n = Number(qty);
  if (isFinite(n) && n > 1) {
    const at = waQuoteEach(m, n);
    lines.push(`${n} ${m.unit ? m.unit + (String(m.unit).endsWith("s") ? "" : "s") : ""} comes to UGX ${Math.round(n * at.each).toLocaleString("en-UG")}${at.why ? ` at UGX ${Number(at.each).toLocaleString("en-UG")} each (${at.why})` : ""}.`);
  }
  breaks.slice(0, 1).forEach((b) =>
    lines.push(`Buy ${b.qty}+ at UGX ${Number(b.price).toLocaleString("en-UG")}.`));
  const goes = m.companion;
  if (goes) lines.push(`Usually taken with ${goes.label}: UGX ${Number(goes.price).toLocaleString("en-UG")}${goes.unit ? " per " + goes.unit : ""}.`);
  lines.push("Reply here to order, or ask about anything else.");
  return lines.join("\n");
}

// STOP in the customer's own words -- and a few of the words they
// actually use. Pure, so the harness can hold the whole vocabulary.
function waOptOutCommand(text: string) {
  const t = String(text || "").toLowerCase().replace(/[^a-z ]+/g, " ").trim();
  if (["stop", "unsubscribe", "opt out", "no promotions", "stop promotions"].includes(t)) return "stop";
  if (["start", "subscribe", "opt in"].includes(t)) return "start";
  return null;
}

async function maybeAutoQuote(shopId: string, phoneNumberId: string, convId: number, waId: string, text: string) {
  const { data: numRow } = await admin.from("wa_numbers")
    .select("auto_quote").eq("shop_id", shopId).maybeSingle();
  // The catalog id is no longer a gate: a shop can answer questions
  // without running a storefront, and requiring one meant a shop that
  // had not finished Commerce Manager answered nobody.
  if (!numRow || !numRow.auto_quote || !ACCESS_TOKEN) return;
  const items = await quotePackItems(shopId);
  if (!items || !items.length) return;
  const m = waExactMatch(text, items);
  if (!m) return;
  const reply = waQuoteReply(m, waAskedQty(text, m));
  // Parrot guard: the same answer, twice in an hour, to the same
  // conversation is noise, not service.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin.from("wa_messages")
    .select("id").eq("conversation_id", convId).eq("direction", "out")
    .eq("body", reply).gte("sent_at", cutoff).limit(1);
  if (recent && recent.length) return;
  const wamid = await sendText(phoneNumberId, waId, reply);
  if (!wamid) return;
  const now = new Date().toISOString();
  const { error } = await admin.from("wa_messages").insert({
    shop_id: shopId, conversation_id: convId, wamid,
    direction: "out", msg_type: "text", body: reply, status: "sent", sent_at: now,
    // The marker the inbox shows: the shop always knows which words the
    // system said in its name.
    payload: { auto: true },
  });
  if (error) console.error("wa-webhook: auto-quote record failed AFTER delivery", error);
  await admin.from("wa_conversations").update({ last_message_at: now }).eq("id", convId);
  console.log("wa-webhook: auto-quoted", m.name, "to conversation", convId);
}

async function conversationFor(shopId: string, waId: string, name: string | null, ts: string, inbound: boolean): Promise<number | null> {
  // Upsert keyed on (shop_id, wa_id); last_inbound_at only ever moves
  // FORWARD and only for real inbound -- it is the 24h window's anchor.
  const { data: existing, error: selErr } = await admin.from("wa_conversations")
    .select("id, last_message_at, last_inbound_at").eq("shop_id", shopId).eq("wa_id", waId).maybeSingle();
  if (selErr) { console.error("wa-webhook: conversation lookup failed", selErr); return null; }
  if (!existing) {
    const { data: ins, error: insErr } = await admin.from("wa_conversations").insert({
      shop_id: shopId, wa_id: waId, profile_name: name,
      last_message_at: ts, last_inbound_at: inbound ? ts : null,
    }).select("id").single();
    if (insErr) {
      // Two events for a brand-new conversation can race; the unique
      // (shop_id, wa_id) makes one lose -- re-read instead of failing.
      const { data: again } = await admin.from("wa_conversations")
        .select("id").eq("shop_id", shopId).eq("wa_id", waId).maybeSingle();
      return again ? Number(again.id) : null;
    }
    return Number(ins.id);
  }
  const patch: Record<string, unknown> = {};
  if (name) patch.profile_name = name;
  if (!existing.last_message_at || ts > existing.last_message_at) patch.last_message_at = ts;
  if (inbound && (!existing.last_inbound_at || ts > existing.last_inbound_at)) patch.last_inbound_at = ts;
  if (Object.keys(patch).length) {
    const { error } = await admin.from("wa_conversations").update(patch).eq("id", existing.id);
    if (error) console.error("wa-webhook: conversation update failed", error);
  }
  return Number(existing.id);
}

async function handleEvents(shopId: string, phoneNumberId: string, events: WaEvent[]) {
  for (const ev of events) {
    if (ev.kind === "status") {
      const { error } = await admin.from("wa_messages")
        .update({ status: ev.status }).eq("shop_id", shopId).eq("wamid", ev.wamid);
      if (error) console.error("wa-webhook: status update failed", error);
      continue;
    }
    const convId = await conversationFor(shopId, ev.waId, ev.kind === "in" ? ev.name : null, ev.ts, ev.kind === "in");
    if (convId == null) continue;
    const { data: landed, error } = await admin.from("wa_messages").upsert({
      shop_id: shopId, conversation_id: convId, wamid: ev.wamid,
      direction: ev.kind === "in" ? "in" : "out",
      msg_type: ev.type, body: ev.body, payload: ev.payload,
      status: ev.kind === "out" ? "sent" : null, sent_at: ev.ts,
    }, { onConflict: "shop_id,wamid", ignoreDuplicates: true }).select("id");
    if (error) { console.error("wa-webhook: message insert failed", error); continue; }
    // An order becomes an order EXACTLY once: only when the message row
    // was newly inserted. Meta retries webhooks, and a retried cart must
    // not become a second order -- the unique wamid answers a duplicate
    // with an empty insert, and the empty insert means do nothing.
    // deno-lint-ignore no-explicit-any
    const orderPayload = (ev as any).payload?.order;
    if (ev.kind === "in" && ev.type === "order" && orderPayload && (landed ?? []).length > 0) {
      await createWaOrder(shopId, phoneNumberId, ev.waId, ev.name, orderPayload, ev.wamid);
    }
    // Auto-quote rides the same freshly-landed gate as orders: a
    // webhook retry that bounced off the unique wamid must not answer
    // the customer twice.
    if (ev.kind === "in" && ev.type === "text" && ev.body && (landed ?? []).length > 0) {
      const cmd = waOptOutCommand(ev.body);
      if (cmd) {
        // Honoured FIRST and INSTANTLY -- an opt-out that waits for a
        // human, or gets answered with a product quote, defeats itself.
        const { error } = await admin.from("wa_conversations")
          .update({ opt_out: cmd === "stop" }).eq("id", convId);
        if (error) console.error("wa-webhook: opt-out update failed", error);
        const ack = cmd === "stop"
          ? "Done — you won't receive promotions from us again. Reply START any time to rejoin. You can still order and ask questions here as normal."
          : "Welcome back — you'll receive our offers again. Reply STOP any time to leave.";
        const ackWamid = await sendText(phoneNumberId, ev.waId, ack);
        if (ackWamid) {
          const now = new Date().toISOString();
          await admin.from("wa_messages").insert({
            shop_id: shopId, conversation_id: convId, wamid: ackWamid,
            direction: "out", msg_type: "text", body: ack, status: "sent", sent_at: now,
            payload: { auto: true },
          });
          await admin.from("wa_conversations").update({ last_message_at: now }).eq("id", convId);
        }
      } else {
        await maybeAutoQuote(shopId, phoneNumberId, convId, ev.waId, ev.body);
      }
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Meta's subscription handshake.
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      console.log("wa-webhook: handshake OK");
      return new Response(challenge, { status: 200 });
    }
    console.error("wa-webhook: handshake refused", { mode, tokenMatches: token === VERIFY_TOKEN, hasVerifyToken: !!VERIFY_TOKEN });
    return json({ error: "verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const raw = await req.text();
  if (APP_SECRET) {
    const ok = await validSignature(raw, req.headers.get("x-hub-signature-256"), APP_SECRET);
    if (!ok) {
      // LOUD on purpose: a silent 401 here cost a live debugging session
      // -- the function booted, said nothing, and every delivery died.
      // A mismatch means the WHATSAPP_APP_SECRET secret differs from the
      // app's actual App secret.
      console.error("wa-webhook: SIGNATURE REJECTED — WHATSAPP_APP_SECRET does not match the Meta app secret",
        { hasHeader: !!req.headers.get("x-hub-signature-256") });
      return json({ error: "bad signature" }, 401);
    }
  } else {
    console.error("wa-webhook: WHATSAPP_APP_SECRET unset — accepting unsigned traffic until it is set");
  }

  try {
    const body = JSON.parse(raw);
    for (const entry of (Array.isArray(body.entry) ? body.entry : [])) {
      for (const change of (Array.isArray(entry.changes) ? entry.changes : [])) {
        const { phoneNumberId, events } = normalizeChange(change.value ?? {});
        if (!events.length) continue;
        if (!phoneNumberId) { console.error("wa-webhook: change without phone_number_id"); continue; }
        const { data: numRow, error } = await admin.from("wa_numbers")
          .select("shop_id").eq("phone_number_id", phoneNumberId).maybeSingle();
        if (error || !numRow) {
          console.error("wa-webhook: no shop mapped for phone_number_id", phoneNumberId, error);
          continue;
        }
        await handleEvents(String(numRow.shop_id), phoneNumberId, events);
        // Success says so too -- absence of errors must be distinguishable
        // from absence of traffic.
        console.log("wa-webhook: filed", events.length, "event(s) for", phoneNumberId);
      }
    }
  } catch (e) {
    console.error("wa-webhook: processing failed", e);
  }
  // 200 no matter what happened above -- see the header comment.
  return json({ received: true });
});
