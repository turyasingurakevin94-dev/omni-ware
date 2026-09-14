#!/usr/bin/env node
'use strict';
/*
 * client-submit-order -- the customer's order, priced by the shop.
 *
 * One claim to defend, and everything here defends it: THE BROWSER SENDS
 * QUANTITIES AND NOTHING ELSE. Not a price, not a total, not a figure to
 * check against. agent-submit-order puts the reasoning well and it is
 * stronger here: RLS controls which rows a caller may touch, never
 * whether the values inside them are honest -- and a customer has no
 * Supabase identity at all, so this function is the entire gate.
 *
 * The second claim is that the price charged is the price shown. That is
 * not a comment but an arithmetic fact, and it holds only while this
 * file's pricing helpers are character-for-character what client-portal
 * used to show the number. Both are compared below.
 *
 * Run: node test/client-submit-order.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client submit order');
const src = read('supabase/functions/client-submit-order/index.ts');
const portal = read('supabase/functions/client-portal/index.ts');
const app = read('index.html');
const noComments = src.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
/* The request handler alone. The copied helpers above it walk STORED
   order lines -- rememberedPrices reads `it.sellPrice` off a past order,
   which is the whole point of a remembered price -- and a scan over the
   whole file cannot tell that `it` from the `it` in an incoming basket.
   Reading the request is what section 1 is about, so it reads only the
   part of the file that does. */
const handler = noComments.slice(noComments.indexOf('Deno.serve('));

/* ---------- 1. no client-supplied price, anywhere ---------------------- */
{
  /* The body is destructured in exactly one place. If a price ever
     arrived, this is where it would be read, so this is where it is
     refused. */
  const reads = [...handler.matchAll(/body\.(\w+)/g)].map(m => m[1]);
  const allowed = ['shopId', 'items', 'token', 'note', 'deliverTo'];
  const extra = [...new Set(reads)].filter(r => !allowed.includes(r));
  t.check(extra.length === 0, `the request body is read for ${allowed.join(', ')} and nothing else (${extra.join(', ') || 'none extra'})`);

  // And each item is read for three fields.
  const itemReads = [...new Set([...handler.matchAll(/\bit\.(\w+)/g)].map(m => m[1]))];
  const itemAllowed = ['productId', 'variantIdx', 'qty'];
  const itemExtra = itemReads.filter(r => !itemAllowed.includes(r));
  t.check(itemExtra.length === 0,
    `and each line for productId, variantIdx and qty (${itemExtra.join(', ') || 'none extra'})`);

  // The words a tampered request would use.
  ['sellPrice', 'unitPrice', 'total', 'price'].forEach((word) => {
    t.check(!new RegExp(`(body|it)\\.${word}\\b`).test(handler),
      `no ${word} is ever read off the request`);
  });
}

/* ---------- 2. every line is priced here ------------------------------ */
{
  t.check(/customerUnitPrice\(product, row, qty, defaultMarkup, held\[key\] \|\| null\)/.test(noComments),
    'each line is priced from live data at the quantity asked for');
  t.check(/sellPrice: priced\.unitPrice/.test(noComments),
    'and what the shop is owed is that computed number');
  t.check(/price: priced\.cost/.test(noComments),
    'with the real supplier cost beside it, the way a staff-built quote carries it');
  t.check(/const total = lineItems\.reduce/.test(noComments),
    'the total is summed from the priced lines, never taken from the request');

  /* pickBestPriceRow, not quotableRow. The catalogue deliberately keeps
     an out-of-stock item visible with its price -- a customer planning a
     job needs the number. An order is CHARGED, and promising against a
     row the shop cannot buy from is a different thing entirely. */
  t.check(/pickBestPriceRow\(rowsByKey\.get\(key\) \|\| \[\]\)/.test(noComments),
    'an order prices only against a row that can actually be bought');
  t.check(!/quotableRow/.test(noComments),
    'never the one the catalogue uses to keep an out-of-stock item on the shelf');
  t.check(/\}, 409\)/.test(noComments),
    'and a line that cannot be priced comes back as a refusal naming it');
}

/* ---------- 3. the price charged is the price shown -------------------- */
/*
 * Verbatim, because these two files are a duplicate by policy and a
 * duplicate by policy is a duplicate somebody edits on one side.
 */
{
  ['normalisePhone', 'sha256Hex', 'effectiveMarkupRule', 'suggestedSellingPrice',
   'tieredUnitPrice', 'pickBestPriceRow', 'rememberedPrices', 'customerUnitPrice']
    .forEach((fn) => {
      const a = extractFunction(src, fn, 'client-submit-order');
      const b = extractFunction(portal, fn, 'client-portal').replace(/^export /, '');
      t.check(a === b, `${fn}() is identical to client-portal's copy`);
    });
  // Matched across the line break the comment wraps at.
  t.check(/duplicated VERBATIM/.test(src) && /client-portal/.test(src),
    'and the file says it is a copy, so the next reader knows to edit both');

  // The remembered price is the same memory, found the same way -- a
  // customer charged a number they were never shown is the failure this
  // whole arrangement exists to prevent.
  t.check(/const held = rememberedPrices\(quotes \|\| \[\], mine\);/.test(noComments),
    'the remembered price is looked up here too, from the same function');
  t.check(/const mine = normalisePhone\(customer\.phone\);/.test(noComments),
    'keyed on the normalised phone, never the name');
}

/* ---------- 4. whose order it is -------------------------------------- */
{
  t.check(/sessionAccount\(shopId, String\(body\.token \?\? ""\)\)/.test(noComments)
    && /if \(!session\) return json\(\{ error: "Sign in again" \}, 401\)/.test(noComments),
    'a session is proved before anything is written');
  t.check(noComments.indexOf('sessionAccount') < noComments.indexOf('from("products")'),
    'and before the catalogue is even read');

  /* A suspended account keeps its history and loses its counter. Its
     sessions are revoked when the shop suspends it, so this is the belt
     to that braces: a token minted before the suspension must not place
     an order after it. */
  t.check(/account\.status !== "active"/.test(noComments) && /\}, 403\)/.test(noComments),
    'a suspended account cannot order, whatever token it holds');

  t.check(/client_name: customer\.name/.test(noComments) && /client_phone: customer\.phone/.test(noComments),
    'the order is written in the CUSTOMER\'s name, not an intermediary\'s');
  t.check(/customerId,/.test(noComments),
    'and carries the customer id, which a counter-built quote has never had');
}

/* ---------- 5. the status is one the shop's board knows ---------------- */
/*
 * client-portal once filtered on status "order", which this app has never
 * written -- so every customer's order list came back empty and nobody
 * noticed. A status written here and not on the board would fail the same
 * way round: an order that exists and appears nowhere.
 */
{
  const block = /const SQ_STATUSES = \{([\s\S]*?)\n\};/.exec(app);
  t.check(!!block, 'the shop\'s status ladder is found');
  const known = block ? (block[1].match(/^\s*(\w+):/gm) || []).map(x => x.replace(/[\s:]/g, '')) : [];
  const written = /status: "([^"]+)"/.exec(noComments);
  t.check(!!written && known.includes(written[1]),
    `the status written is one the board knows (${written && written[1]}, of ${known.join('/')})`);
  t.check(written && written[1] === 'draft',
    'and it is the first rung -- a portal order is not a lesser kind of order');
}

/* ---------- 6. nothing comes back that should not ---------------------- */
{
  /* supplier_id IS read here, unlike in client-portal: it goes onto the
     stored line so the shop knows where to buy, exactly as a staff-built
     quote carries it. It must not come back in the reply. */
  t.check(/supplier_id/.test(noComments), 'the supplier is read, because the stored line needs it');
  t.check(/supplierId: row\.supplier_id/.test(noComments), 'and written onto the order');

  const replyPush = /reply\.push\(\{[\s\S]*?\}\);/.exec(noComments);
  t.check(!!replyPush, 'the reply line is built in one place');
  if (replyPush) {
    /* \b on the key, or `unitPrice:` -- the one field that SHOULD be
       there -- reads as a `price:` leak and the check fails on correct
       code. */
    [['supplier', /supplier/i], ['cost', /\bcost\b/i], ['a raw price', /\bprice\s*:/],
     ['wholesale', /wholesale/i], ['retail', /retail/i], ['markup', /markup/i]].forEach(([name, re]) => {
      t.check(!re.test(replyPush[0]), `and carries no ${name}`);
    });
    t.check(/unitPrice: priced\.unitPrice/.test(replyPush[0]),
      'only what the customer is charged');
  }
  // Two different objects on purpose -- one spread would merge them.
  t.check(!/\.\.\.(lineItems|priced|row|product|customer|it)\b/.test(noComments),
    'and the stored line is never spread into the reply, nor anything else into anything');
  t.check(!/console\.log/.test(noComments), 'nothing is logged');
}

/* ---------- 7. the same basket twice is one order --------------------- */
{
  const { basketFingerprint } = compileScope(
    [extractFunction(src, 'basketFingerprint', 'client-submit-order')], {}, ['basketFingerprint'], { typescript: true });
  const a = [{ productId: 'P1', variantIdx: null, qty: 3 }, { productId: 'P2', variantIdx: 1, qty: 5 }];
  const b = [{ productId: 'P2', variantIdx: 1, qty: 5 }, { productId: 'P1', variantIdx: null, qty: 3 }];
  t.check(basketFingerprint(a) === basketFingerprint(b),
    'the same basket in a different order is the same basket');
  t.check(basketFingerprint(a) !== basketFingerprint([{ productId: 'P1', variantIdx: null, qty: 4 }, a[1]]),
    'a changed quantity is a different one');
  t.check(basketFingerprint(a) !== basketFingerprint([{ productId: 'P1', variantIdx: 0, qty: 3 }, a[1]]),
    'and so is a different variant');
  // Built from what the customer chose, never from a derived figure: a
  // price that moved between two taps must not stop a genuine re-send
  // being recognised as one.
  t.check(!/sellPrice|unitPrice|cost/.test(extractFunction(src, 'basketFingerprint', 'client-submit-order')),
    'and it is built from no figure this function derives');
  t.check(/q\.payload\?\.customerId === customerId/.test(noComments),
    'the match is scoped to this customer, so two people ordering the same thing are two orders');
}

/* ---------- 8. the size of a basket ----------------------------------- */
{
  t.check(/items\.length > MAX_LINES/.test(noComments) && /const MAX_LINES = \d+;/.test(noComments),
    'a basket has a line limit, so one request cannot ask the shop to price a catalogue');
  t.check(/qty > MAX_QTY/.test(noComments), 'and a quantity ceiling');
  t.check(/!\(qty > 0\)/.test(noComments), 'a line with no quantity is refused');
  t.check(/if \(!items\.length\)/.test(noComments), 'and an empty basket is not an order');
}

process.exit(t.done() ? 1 : 0);
