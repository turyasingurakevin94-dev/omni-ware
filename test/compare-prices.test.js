#!/usr/bin/env node
'use strict';
/*
 * Who to buy from.
 *
 * The page ranked suppliers on r.wholesale and r.retail -- the flat
 * fields deriveWholesaleRetail() builds, which its own comment calls
 * "the price before any volume discount kicks in" -- and split them into
 * two static columns. Neither is what the shop pays.
 *
 * THE CHEAPEST SUPPLIER CHANGES WITH THE QUANTITY. That is what a volume
 * tier IS, and the page had no quantity to rank at. Verified on the
 * running app before any of this was written:
 *
 *   at 1 bag     Hima 34,000 · Tororo 35,000   page said Hima BEST
 *   at 100 bags  Tororo 29,000 · Hima 34,000   page STILL said Hima
 *
 * 5,000 a bag wrong, 500,000 on the order, on the one screen whose whole
 * job is that decision. And the recommendation rested on a price eight
 * months old, ranked equal to one from two days before, with the date
 * printed as a bare string in the last column.
 *
 * Run: node test/compare-prices.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('compare prices');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['cmpKindAtQty', 'cmpNextBreak', 'purchasePriceAtQty', 'tieredUnitPrice',
  'tiersForKind', 'invertedTierPairs'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the compare helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const render = (/function renderCompare[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const section = (/<section id="tab-compare"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];

/* ---------- 1. it ranks at a quantity -------------------------------- */
{
  t.check(/id="cmp_qty"/.test(section), 'the page asks how many are being bought');
  t.check(/getElementById\('cmp_qty'\)\.addEventListener\('input', renderCompare\)/.test(code),
    'and re-answers when that changes');

  /* THE FIX. rankedPurchaseRowsAtQty is what the buying list uses, so
     the two screens cannot name different suppliers for one purchase. */
  t.check(/rankedPurchaseRowsAtQty\(productId, variantIdx, qty\)/.test(render),
    'the ranking is at that quantity, from the same arithmetic the buying list uses');
  t.check(!/\.sort\(\(a,b\)=>a\.wholesale-b\.wholesale\)/.test(code)
    && !/\.sort\(\(a,b\)=>a\.retail-b\.retail\)/.test(code),
    'and never again on the flat price-before-any-discount fields');
  t.check(!/<div class="compare-col"><h3>Wholesale<\/h3>/.test(src),
    'the two static columns, which were derived artefacts rather than the decision, are gone');

  /* A quantity of nothing is not a purchase, and dividing the decision
     by it would rank on prices for zero items. */
  const q = (/function cmpQty[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/return v > 0 \? v : 1;/.test(q), 'a blank or zero quantity falls back to one rather than to nothing');
}

/* ---------- 2. the pack split is read the same way ------------------- */
{
  if (scope) {
    // Loose items below the pack size, wholesale at or above it -- the
    // same test purchasePriceAtQty makes, so a suggested selling price is
    // built on the rate actually being paid.
    eq(scope.cmpKindAtQty({ packQty: 12 }, 5), 'retail', 'below a pack it is the retail side');
    eq(scope.cmpKindAtQty({ packQty: 12 }, 12), 'wholesale', 'at the pack size it crosses');
    eq(scope.cmpKindAtQty({ packQty: 12 }, 100), 'wholesale', 'and stays crossed above it');
    eq(scope.cmpKindAtQty({ packQty: 0 }, 500), 'retail',
      'an item sold in no pack is always the retail side, however many are bought');
  }
  t.check(/suggestedSellingPrice\(product, r\.purchasePrice, kind, variantIdx, r\.packQty\)/.test(render),
    'the selling price is worked out from what this quantity actually costs');
}

/* ---------- 3. the next price break ---------------------------------- *
 * A shop buying 80 of something that drops at 100 is the fact this page
 * could always have given and never did.
 */
{
  if (scope) {
    const row = { packQty: 0, tiers: [{ minQty: 1, price: 35000 }, { minQty: 100, price: 29000 }] };
    const nb = scope.cmpNextBreak(row, 80);
    t.check(!!nb, 'a cheaper rung ahead is found');
    eq(nb.more, 20, 'saying how many more it takes to reach it');
    eq(nb.price, 29000, 'and what it drops to');

    t.check(scope.cmpNextBreak(row, 100) === null, 'once reached there is nothing ahead to report');
    t.check(scope.cmpNextBreak({ packQty: 0, tiers: [{ minQty: 1, price: 35000 }] }, 5) === null,
      'and a flat price has no break to reach');
    /* A rung ahead that costs MORE is not a break. Reporting it as one
       would advise buying more to pay more. */
    t.check(scope.cmpNextBreak({ packQty: 0,
      tiers: [{ minQty: 1, price: 36000 }, { minQty: 50, price: 38000 }] }, 10) === null,
      'a dearer rung ahead is not offered as a saving');

    /* A rung BEHIND the quantity is not ahead of it. On an inverted
       ladder — 30,000 at one, 35,000 at fifty — somebody already buying
       sixty is paying 35,000, and the cheaper rung is sixty back. Without
       the > qty filter it is offered as the next break, at "-59 more".
       Every other fixture here gave the same answer either way. */
    t.check(scope.cmpNextBreak({ packQty: 0,
      tiers: [{ minQty: 1, price: 30000 }, { minQty: 50, price: 35000 }] }, 60) === null,
      'and a cheaper rung already behind them is not offered as one ahead');
  }
  t.check(/more &rarr; /.test(render), 'and the row says it in those terms');
  /* What the whole order costs at each supplier, beside the unit price.
     Comparing 29,000 with 34,000 is arithmetic somebody should not have
     to do while a lorry waits. */
  t.check(/esc\(fmtUGX\(Math\.round\(r\.purchasePrice \* qty\)\)\) : '—'\}<\/td>/.test(render),
    'and every row carries what the whole order would cost there');
}

/* ---------- 4. what the choice is worth ------------------------------ */
{
  /* "BEST" alone does not say whether the next supplier is a thousand
     behind or half a million. */
  t.check(/const savingPerUnit = \(best && runnerUp\) \? \(runnerUp\.purchasePrice - best\.purchasePrice\) : 0;/.test(render),
    'the gap to the next supplier is worked out');
  t.check(/const savingTotal = savingPerUnit \* qty;/.test(render),
    'and multiplied by what is being bought, which is the figure that lands');
  t.check(/less than \$\{esc\(runnerUp\.sname\)\}/.test(render), 'named against who it beats');
  t.check(/The same as \$\{esc\(runnerUp\.sname\)\}/.test(render),
    'with a tie said as a tie rather than as a saving of nothing');
  t.check(/The only supplier with a price/.test(render),
    'and one supplier said plainly rather than compared to nobody');
}

/* ---------- 5. whether the figures can be trusted -------------------- */
{
  /* The recommendation rested on an eight-month-old price, ranked equal
     to one from two days before. PRICE_STALE_DAYS is the registry's own
     threshold, reused so the two screens cannot disagree about old. */
  t.check(/priceAgeDays\(best\.date\)/.test(render), 'the age of the winning price is worked out');
  t.check(/bestAge > PRICE_STALE_DAYS/.test(render),
    'against the same threshold the price registry uses');
  /* Pinned on the condition, not the sentence: making staleNote
     unconditionally empty left the words sitting in a dead template
     while the check went on passing. */
  t.check(/const staleNote = \(best && bestAge != null && bestAge > PRICE_STALE_DAYS\)/.test(render),
    'and only when it IS stale');
  t.check(/Worth confirming before ordering/.test(render),
    'saying so in terms of the money about to be committed');
  /* ALL THREE uses. The threshold is read in three places — colouring
     the headline, raising the note, marking each row's own date — and
     pinning it loosely let the headline drift to its own number while
     the note kept the shared one and the check went on passing. */
  eq((render.match(/PRICE_STALE_DAYS/g) || []).length, 3,
    'with the headline, the note and every row reading the one threshold');

  /* No date is not a fresh date. */
  t.check(/priceAgeDays\(r\.date\) == null/.test(render) && /no date on file/.test(render),
    'a price with no date says so rather than passing as current');
  t.check(/age == null \? 'no date'/.test(render), 'on its own row too');

  /* invertedTierPairs already existed and nothing showed it here: a
     ladder where buying more costs more drags the ranking around
     silently. */
  t.check(/invertedTierPairs\(Array\.isArray\(r\.tiers\) \? r\.tiers : \[\]\)/.test(render),
    'a ladder where buying more costs more is detected');
  t.check(/probably a typo/.test(render), 'and flagged on the supplier it belongs to');
}

/* ---------- 6. what it does not pretend to know ---------------------- */
{
  /* Units are singular labels ("Bag", "Ctn") and nothing here can
     pluralise them, so the headline does not try -- "100 Bag" was the
     best it could have managed. */
  t.check(/Cheapest for \$\{esc\(String\(qty\)\)\}<\/span>/.test(render),
    'the headline does not attempt to pluralise a unit it cannot');
  t.check(/id="cmp_qty_unit"/.test(section),
    'the unit sits beside the quantity box, where it reads correctly');

  t.check(/No usable price/.test(render),
    'and a product whose suppliers have no figure for this quantity says that, rather than ranking nothing');
}

process.exit(t.done() ? 1 : 0);
