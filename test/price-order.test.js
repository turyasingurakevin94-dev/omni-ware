#!/usr/bin/env node
'use strict';
/*
 * The order the Price Registry puts things in.
 *
 * The registry groups by what is being priced -- one card per product or
 * variant, its suppliers underneath it cheapest first -- so the ordering
 * question is which CARD comes first. It opened on product name, which
 * meant a price entered a moment ago could be anywhere in the list.
 *
 * "Recently added" is now the default, and it is deliberately NOT the
 * same question as "most recently repriced":
 *
 *   Date updated   when the SUPPLIER quoted it. Typed by hand, and
 *                  backdated on purpose when a quote is entered late.
 *   entry order    when the row was actually written here.
 *
 * Enter last week's quote today and it is the most recently ADDED thing
 * in the registry while being one of the least recently repriced. Both
 * are true; they answer different questions, and the dropdown offers
 * both.
 *
 * Entry order is read off the row id, which is issued in sequence and
 * never reused, so a bigger id was written later.
 *
 * Run: node test/price-order.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('price order');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const scope = compileScope([
  extractFunction(src, 'todayISO', 'index.html'),
  extractFunction(src, 'priceAgeDays', 'index.html'),
  extractFunction(src, 'priceGroupsFor', 'index.html'),
], { purchasePriceAtQty: (r) => (r.wholesale == null ? null : r.wholesale) },
  ['priceGroupsFor', 'priceAgeDays']);

const day = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
const row = (o) => Object.assign({ productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 1000, date: day(1), pname: 'Thing', category: '', image: null }, o);
const order = (rows, mode) => scope.priceGroupsFor(rows, mode).map((g) => g.pname).join(',');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the entry just made is the card on top ----------------- */
{
  const rows = [
    row({ id: 10, productId: 'P1', pname: 'Cement' }),
    row({ id: 30, productId: 'P2', pname: 'Nails' }),      // entered last
    row({ id: 20, productId: 'P3', pname: 'Angle' }),
  ];
  eq(order(rows, 'added'), 'Nails,Angle,Cement',
    'the most recently entered card comes first');
  eq(order(rows, 'name'), 'Angle,Cement,Nails',
    'and by name is still there, unchanged, for anyone who wants the alphabet');
}

/* ---------- 2. a card rises on its NEWEST quote ----------------------- */
/*
 * A product priced by three suppliers years apart is not an old card the
 * moment one of them requotes. The group takes the newest entry in it.
 */
{
  const rows = [
    row({ id: 1, productId: 'P1', pname: 'Cement' }),
    row({ id: 2, productId: 'P1', pname: 'Cement', supplierId: 'S2' }),
    row({ id: 90, productId: 'P1', pname: 'Cement', supplierId: 'S3' }),   // just added
    row({ id: 50, productId: 'P2', pname: 'Nails' }),
  ];
  eq(order(rows, 'added'), 'Cement,Nails',
    'a card with an old quote and a new one ranks on the new one');
}

/* ---------- 3. added is not the same as repriced ---------------------- */
/*
 * The distinction the whole feature rests on. Entering last week's quote
 * today makes it the newest ENTRY and one of the oldest REPRICINGS.
 */
{
  const rows = [
    row({ id: 5, productId: 'P1', pname: 'Cement', date: day(0) }),    // quoted today, entered first
    row({ id: 99, productId: 'P2', pname: 'Nails', date: day(30) }),   // quoted a month ago, entered just now
  ];
  eq(order(rows, 'added'), 'Nails,Cement',
    'the backdated quote entered a moment ago is the most recently ADDED');
  eq(order(rows, 'newest'), 'Cement,Nails',
    'and the same two rows come out the other way round by most recently repriced');
  t.check(order(rows, 'added') !== order(rows, 'newest'),
    'so the two sorts really are answering different questions');
}

/* ---------- 4. ids that cannot be read -------------------------------- */
{
  /* A row with no usable id has no place in an entry order. It ranks
     below every row that has one, and ties fall back to the name so the
     result is still a definite order rather than an arbitrary one. */
  const rows = [
    row({ id: undefined, productId: 'P1', pname: 'Zinc' }),
    row({ id: undefined, productId: 'P2', pname: 'Angle' }),
    row({ id: 7, productId: 'P3', pname: 'Nails' }),
  ];
  eq(order(rows, 'added'), 'Nails,Angle,Zinc',
    'rows with no readable id sort last, and among themselves by name');

  const both = scope.priceGroupsFor([
    row({ id: undefined, productId: 'P1', pname: 'A' }),
    row({ id: undefined, productId: 'P2', pname: 'B' }),
  ], 'added');
  t.check(both.length === 2 && both[0].pname === 'A',
    'two unreadable ids compare to a definite answer, not to NaN');
}

/* ---------- 5. the rest of the card is untouched ---------------------- */
{
  /* Ordering the cards must not reorder the suppliers inside one: the
     registry exists to answer "who is cheapest for this", and that is
     what the rows under each card say. */
  /* The dear one is deliberately the LATER entry. With it entered second,
     cheapest-first and newest-first disagree — so this catches an entry
     order leaking down into the rows, which a fixture where the cheap one
     happened to be newest would not. */
  const rows = [
    row({ id: 2, productId: 'P1', pname: 'Cement', supplierId: 'CHEAP', wholesale: 3000 }),
    row({ id: 9, productId: 'P1', pname: 'Cement', supplierId: 'DEAR', wholesale: 9000 }),
  ];
  const g = scope.priceGroupsFor(rows, 'added')[0];
  eq(g.rows.map((r) => r.supplierId).join(','), 'CHEAP,DEAR',
    'suppliers stay cheapest first inside the card, even when the dearest was entered last');
  eq(g.cheapestId, 2, 'and the cheapest is still marked');
}

/* ---------- 6. offered, and offered first ----------------------------- */
{
  t.check(/\{ key:'added',  label:'Recently added' \}/.test(code),
    'the sort is on the dropdown');
  const list = /const PRICE_SORTS = \[([\s\S]*?)\];/.exec(code);
  t.check(!!list && /^\s*\{ key:'added'/.test(list[1].split('\n').filter((l) => l.trim())[0]),
    'and first, so the dropdown opens on it — which is what makes it the default');
  t.check(/function renderPrices\(filter='', supplierFilter='', categoryFilter='', ageFilter='', sortMode='added'/.test(code),
    'and the render agrees, rather than defaulting to something the dropdown never says');
  /* Built from the list, so an option cannot exist that the sort does not
     handle — the reason the dropdown is generated rather than written out. */
  t.check(/sort\.innerHTML = PRICE_SORTS\.map/.test(code),
    'the dropdown is still built from the same list it is read by');
}

process.exit(t.done() ? 1 : 0);
