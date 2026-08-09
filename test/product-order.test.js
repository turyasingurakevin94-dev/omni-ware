#!/usr/bin/env node
'use strict';
/*
 * The order products come out in.
 *
 * The list used to appear in whatever order the server returned -- not
 * alphabetical, not by age, no order at all. Now the newest is first,
 * because straight after adding a product the top of the list is where
 * you look for it.
 *
 * Two things this has to get right.
 *
 * AN UNDATED PRODUCT IS NOT A NEW ONE. Products saved before the date
 * column existed have no createdAt. Sorting them as though they were new
 * would put the oldest things in the shop at the top, which is the exact
 * opposite of what was asked for. They rank below every dated product,
 * and fall back to the ID -- issued in sequence, so "newest first" still
 * means something on a shop where nothing is dated.
 *
 * AND THE COMPARATOR MUST NOT RETURN NaN. An undated product ranks at
 * negative infinity; subtracting one infinity from another gives NaN, and
 * a comparator that returns NaN leaves the list in an arbitrary order --
 * which would look exactly like the bug being fixed.
 *
 * Run: node test/product-order.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('product order');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['productRecencyRank', 'productIdNumber', 'compareProductsNewestFirst'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);

const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();
const order = (list) => list.slice().sort(fn.compareProductsNewestFirst).map((p) => p.id).join(',');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the newest is first ------------------------------------ */
{
  const list = [
    { id: 'P010', createdAt: ago(60) },
    { id: 'P020', createdAt: ago(5) },      // added five minutes ago
    { id: 'P030', createdAt: ago(600) },
  ];
  eq(order(list), 'P020,P010,P030', 'the most recently added comes out on top');

  // The reported case, stated plainly: add one now, find it first.
  const withNew = list.concat([{ id: 'P099', createdAt: new Date().toISOString() }]);
  eq(order(withNew).split(',')[0], 'P099', 'a product added just now is the first in the list');
}

/* ---------- 2. a product nobody dated --------------------------------- */
{
  const mixed = [
    { id: 'P010' },                          // saved before the column existed
    { id: 'P020', createdAt: ago(600) },
    { id: 'P030', createdAt: ago(5) },
  ];
  eq(order(mixed), 'P030,P020,P010',
    'an undated product sorts below every dated one, rather than being guessed to the top');

  /* All undated -- an older shop. The IDs are issued in sequence, so they
     still come out newest first rather than in no order at all. */
  eq(order([{ id: 'P010' }, { id: 'P030' }, { id: 'P020' }]), 'P030,P020,P010',
    'with nothing dated at all, the ID carries the order');

  eq(fn.productRecencyRank({ id: 'P1' }), -Infinity, 'no date ranks below every date');
  eq(fn.productRecencyRank({ id: 'P1', createdAt: '' }), -Infinity, 'and so does an empty one');
  eq(fn.productRecencyRank({ id: 'P1', createdAt: 'whenever' }), -Infinity, 'and an unreadable one');
  eq(fn.productRecencyRank(null), -Infinity, 'and no product at all');
}

/* ---------- 3. the comparator never returns NaN ----------------------- */
/*
 * Two undated products both rank at -Infinity. Subtracting would give
 * NaN, and a NaN comparator scrambles the list -- indistinguishable from
 * having no sort, which is what this replaces.
 */
{
  const pairs = [
    [{ id: 'P010' }, { id: 'P020' }],                                   // both undated
    [{ id: 'P010' }, { id: 'P010' }],                                   // identical
    [{ id: 'ODD' }, { id: 'ALSO-ODD' }],                                // no number in either id
    [{ id: 'P010', createdAt: ago(1) }, { id: 'P020' }],                // one of each
    [{ id: 'P010', createdAt: ago(1) }, { id: 'P020', createdAt: ago(1) }],  // same instant
  ];
  const bad = pairs.filter(([a, b]) => Number.isNaN(fn.compareProductsNewestFirst(a, b)));
  t.check(bad.length === 0, `no pair compares to NaN (${bad.length} of ${pairs.length} did)`);

  // And it is a consistent ordering, not merely a non-NaN one.
  const flipped = pairs.filter(([a, b]) => {
    const ab = fn.compareProductsNewestFirst(a, b), ba = fn.compareProductsNewestFirst(b, a);
    return !((ab === 0 && ba === 0) || (ab > 0 && ba < 0) || (ab < 0 && ba > 0));
  });
  t.check(flipped.length === 0, `and swapping the pair swaps the answer (${flipped.length} disagreed)`);

  eq(fn.compareProductsNewestFirst({ id: 'P010' }, { id: 'P010' }), 0, 'two of the same rank equal');
}

/* ---------- 4. ids that are not what the app issues ------------------- */
{
  eq(fn.productIdNumber({ id: 'P042' }), 42, 'the number in an issued ID is what orders it');
  eq(fn.productIdNumber({ id: 'P100' }), 100, 'and 100 is above 42, not below it as text would be');
  eq(fn.productIdNumber({ id: 'ODD' }), -Infinity, 'an ID with no number in it sorts last rather than throwing');
  eq(fn.productIdNumber({}), -Infinity, 'as does a product with no ID');
  eq(fn.productIdNumber(null), -Infinity, 'and no product at all');
  // Text ordering would put P100 between P010 and P020.
  eq(order([{ id: 'P020' }, { id: 'P100' }, { id: 'P010' }]), 'P100,P020,P010',
    'the numbers are compared as numbers, so P100 is newer than P020');
}

/* ---------- 5. sorted before the walk, not after ---------------------- */
{
  const rows = extractFunction(src, 'productRowsForList', 'index.html');
  /* After the walk would interleave one product's variants with another's
     -- a variable product's rows have to stay together under it. */
  t.check(/data\.products\.slice\(\)\.sort\(compareProductsNewestFirst\)\.forEach\(p=>\{/.test(rows),
    'the products are sorted before being flattened, so a product\'s variants stay together');
  t.check(/data\.products\.slice\(\)/.test(rows) && !/data\.products\.sort\(/.test(rows),
    'and on a copy, so sorting the list on screen does not reorder the shop\'s own records');
}

process.exit(t.done() ? 1 : 0);
