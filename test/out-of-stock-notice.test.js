#!/usr/bin/env node
'use strict';
/*
 * "Nobody has priced this" and "everybody who priced it has run out" are
 * different facts, and the quote screen used to report the second as the
 * first.
 *
 * rankedPriceRows() drops out-of-stock suppliers, which is right for
 * recommending somewhere to buy. But the Add-item-to-quote popup counted
 * what was left and, finding nothing, said "No prices recorded for this
 * item yet" about an item a supplier had quoted at 310,000 and simply run
 * out of. Someone quoting a client would price it from scratch, never
 * knowing there was a supplier to ring.
 *
 * The day count is the other half: how long it has been out decides
 * whether you wait for it or source it elsewhere. Rows flagged before
 * that date was recorded report NULL, never zero -- "out of stock since
 * today" is a claim, and an old row cannot make it.
 *
 * Run: node test/out-of-stock-notice.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('out of stock notice');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['todayISO', 'daysSinceDate', 'outOfStockNotice'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);

const dayISO = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
const row = (o) => Object.assign({ supplierId: 'S1', wholesale: null, retail: null, outOfStock: false, outOfStockSince: null }, o);

/* ---------- 1. when there is nothing to say -------------------------- */
{
  t.check(fn.outOfStockNotice([]) === null, 'an item nobody has priced raises no notice');
  t.check(fn.outOfStockNotice(null) === null, 'and neither does no list at all');
  t.check(fn.outOfStockNotice([row({ wholesale: 300000 })]) === null,
    'a supplier who has it in stock raises no notice either');
}

/* ---------- 2. the reported case: priced, then run out --------------- */
/*
 * Elephant King Short/Double Lock: Roto Industry quoted 310,000 and
 * marked it out of stock. The screen said no prices had ever been
 * recorded.
 */
{
  const n = fn.outOfStockNotice([
    row({ supplierId: 'S094', wholesale: 310000, outOfStock: true, outOfStockSince: dayISO(3) }),
  ]);
  t.check(n !== null, 'a supplier who had it and ran out is worth saying out loud');
  t.check(n.entries.length === 1 && n.entries[0].supplierId === 'S094',
    'the notice names who had it, which is who there is to ring');
  t.check(n.entries[0].price === 310000,
    `and what they had it at (${n.entries[0].price})`);
  t.check(n.entries[0].days === 3,
    `and how long it has been out (${n.entries[0].days})`);
  t.check(n.anyInStock === false,
    'with nobody left in stock, which is what makes it a warning rather than a note');
}

/* ---------- 3. days, and the day nobody recorded --------------------- */
{
  const at = (since) => fn.outOfStockNotice([row({ wholesale: 1, outOfStock: true, outOfStockSince: since })]).entries[0].days;
  t.check(at(dayISO(0)) === 0, 'marked out today reads as zero days');
  t.check(at(dayISO(1)) === 1, 'yesterday as one');
  t.check(at(dayISO(45)) === 45, 'and a month and a half as forty-five');
  /* THE HONESTY LINE. A row flagged before the date was recorded cannot
     say how long, and zero would read as "just now" -- the most
     reassuring possible answer to a question nobody can answer. */
  t.check(at(null) === null, 'a row with no date recorded reports null, not zero days');
  t.check(at('') === null, 'and neither does an empty one');
  t.check(at('not-a-date') === null, 'nor an unreadable one');
}

/* ---------- 4. several suppliers, cheapest first --------------------- */
{
  const n = fn.outOfStockNotice([
    row({ supplierId: 'DEAR', wholesale: 340000, outOfStock: true, outOfStockSince: dayISO(1) }),
    row({ supplierId: 'CHEAP', wholesale: 300000, outOfStock: true, outOfStockSince: dayISO(9) }),
    row({ supplierId: 'NOPRICE', outOfStock: true, outOfStockSince: dayISO(2) }),
  ]);
  t.check(n.entries.length === 3, 'every supplier who ran out is listed');
  t.check(n.entries[0].supplierId === 'CHEAP',
    'cheapest first — the one worth chasing is the one who had it cheapest');
  t.check(n.entries[1].supplierId === 'DEAR', 'then the dearer one');
  t.check(n.entries[2].supplierId === 'NOPRICE',
    'and a row with no figure on it sorts last rather than as free');
  t.check(n.entries[2].price === null, 'reported as no price, not as zero');
}
{
  // Retail-only rows still have a figure worth showing.
  const n = fn.outOfStockNotice([row({ retail: 25000, outOfStock: true, outOfStockSince: dayISO(1) })]);
  t.check(n.entries[0].price === 25000, 'a retail-only row shows its retail figure');
}

/* ---------- 5. someone still has it: a note, not a warning ----------- */
{
  const n = fn.outOfStockNotice([
    row({ supplierId: 'GONE', wholesale: 300000, outOfStock: true, outOfStockSince: dayISO(4) }),
    row({ supplierId: 'HAS_IT', wholesale: 320000 }),
  ]);
  t.check(n !== null, 'the cheapest supplier running out is still worth flagging');
  t.check(n.entries.length === 1 && n.entries[0].supplierId === 'GONE',
    'only the ones who ran out are listed');
  t.check(n.anyInStock === true,
    'and the screen is told somebody still has it, so it can soften the wording');
}

/* ---------- 6. wired into the quote popup ---------------------------- */
{
  const stage = extractFunction(src, 'renderIpStage', 'index.html');
  /* Read from ALL rows: ranking is what hides them, so ranked rows can
     never contain the thing being reported. */
  t.check(/outOfStockNotice\(productPriceRows\(ipProductId, variantIdx\)\)/.test(stage),
    'the popup reads every price row, not the ranked ones that just excluded these');
  t.check(!/outOfStockNotice\(ranked\)/.test(stage) && !/outOfStockNotice\(staticRanked\)/.test(stage),
    'not the ranked list, which has already dropped every row this is about');

  /* THE FALSE SENTENCE. It must not appear when a supplier had the item
     and ran out -- that is the exact case it misdescribes. */
  t.check(/\$\{ranked\.length===0 && !oosNotice \? `<div class="q-no-prices">No prices recorded/.test(stage),
    '"no prices recorded" is suppressed when somebody had it and ran out');
  t.check(/oosNotice \? 'No supplier has this in stock right now/.test(stage),
    'and the supplier column says nobody has it rather than nobody priced it');

  t.check(/out of stock, \$\{since\}/.test(stage),
    'each supplier line says how long it has been out');
  t.check(stage.includes("const at = e.price!=null ? ` at ${fmtUGX(e.price)}` : '';")
    && stage.includes('</strong>${at}'),
    'and what they had it at, which is the figure a fresh quote gets measured against');
  t.check(/e\.days==null \? 'date not recorded'/.test(stage),
    'and a row with no date says so, instead of reading as out since today');
  t.check(/Nobody has this in stock right now/.test(stage) && /Cheaper supplier out of stock/.test(stage),
    'the wording differs depending on whether anyone is left to buy from');
}

/* ---------- 7. the date is recorded, and survives ------------------- */
{
  const toggle = extractFunction(src, 'toggleOutOfStock', 'index.html');
  t.check(/r\.outOfStockSince = r\.outOfStock \? todayISO\(\) : null;/.test(toggle),
    'marking out of stock stamps the day, and marking it back in clears it');

  /* Re-pricing an item does not restock it. If a save kept the flag but
     dropped the date, a row whose age was known would start reporting
     "date not recorded" -- the day count decays silently on edit. */
  t.check(/const wasOutOfStockSince = editingRow\.outOfStockSince \|\| null;/.test(code)
    && /outOfStock: wasOutOfStock, outOfStockSince: wasOutOfStockSince/.test(code),
    'editing a price carries the out-of-stock date across with the flag');
  const carried = code.match(/outOfStock: keep \? !!keep\.outOfStock : false, outOfStockSince: keep \? \(keep\.outOfStockSince\|\|null\) : null/g) || [];
  t.check(carried.length === 2,
    `both save paths that keep the flag also keep the date (${carried.length} of 2)`);

  // A field that never reaches the server is a field that resets on reload.
  t.check(/outOfStockSince: pr\.out_of_stock_since \|\| null/.test(code), 'the date is read back from the server');
  t.check(/out_of_stock_since: pr\.outOfStockSince \|\| null/.test(code), 'and written to it');
}

/* ---------- 8. every helper the notice calls actually exists ---------- */
/*
 * This block only runs when a supplier has run out, so a wrong helper
 * name sits there doing nothing until the day somebody quotes exactly
 * that item -- and then it throws, and the whole Add-item popup renders
 * blank. It shipped that way once: fmtMoney, which does not exist.
 * Checking the text of the template cannot see this; checking that the
 * names resolve can.
 */
{
  const stage = extractFunction(src, 'renderIpStage', 'index.html');
  const from = stage.indexOf('const oosNotice');
  const to = stage.indexOf("</div>` : '';", from);
  t.check(from >= 0 && to > from, 'the notice block is where this check thinks it is');
  const block = stage.slice(from, to);
  // index.html loads shared-worker.js, so helpers may live in either.
  const defined = src + '\n' + read('shared-worker.js');
  const builtIn = ['if', 'for', 'while', 'switch', 'catch', 'return', 'function',
    'map', 'join', 'filter', 'sort', 'some', 'every', 'slice', 'Number', 'String'];
  const called = [...new Set((block.match(/\b([a-zA-Z_$][\w$]*)\s*\(/g) || [])
    .map((m) => m.slice(0, -1).trim())
    .filter((n) => !builtIn.includes(n)))];
  const missing = called.filter((n) => !new RegExp(`function ${n}\\s*\\(`).test(defined)
    && !new RegExp(`(const|let|var) ${n}\\s*=`).test(defined));
  t.check(missing.length === 0,
    missing.length ? `the notice calls helpers that do not exist: ${missing.join(', ')}`
      : `every helper the notice calls is defined (${called.length} checked: ${called.join(', ')})`);
}

process.exit(t.done() ? 1 : 0);
