#!/usr/bin/env node
'use strict';
/*
 * The ids on records people can delete.
 *
 * A customer id carries their debt history, a supplier id their
 * invoices, a product id its prices, stock and order lines. So an id
 * must never be handed out twice: reissue one and the new record opens
 * owning everything still pointing at the old one, and nothing announces
 * it. nextEntityId() was written around exactly that -- a persisted
 * counter that only moves forward, maxed against every id on file.
 *
 * AND THE QUOTE SCREEN WENT AROUND IT. generateCustomerId() counted
 * `data.customers.length + 1` and walked up to the first free number.
 * Found live on a real shop: 44 customers occupying C100-C999, and the
 * app offered ids from C045 upward -- every gap left by a deleted
 * customer waiting to be reissued, complete with their debt.
 *
 * A COLLISION MUST NOT STRAND ANYBODY. When a proposed id turned out to
 * be taken, all four save handlers said "Reload and try again" and
 * stopped, with the form full of typing. Reloading fixes nothing: an
 * allocator proposing a low number proposes the same one again. The shop
 * in question could not add a customer at all.
 *
 * Run: node test/entity-ids.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('entity ids');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { idCounters: {}, customers: [], suppliers: [] };
const NAMES = ['nextEntityId', 'firstFreeEntityId', 'generateCustomerId'];
const scope = compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
// The real shop's shape: ids scattered across C100-C999, far above the count.
const realShop = () => {
  data.idCounters = {};
  data.customers = [100, 101, 102, 300, 911, 915, 917, 919, 923, 991, 999]
    .map((n) => ({ id: 'C' + n }));
};

/* ---------- 1. the counter only ever moves forward ------------------- */
{
  data.idCounters = {}; data.customers = [{ id: 'C007' }];
  eq(scope.nextEntityId('customer', 'C', 3, data.customers), 'C008',
    'the next id clears the highest on file');
  eq(scope.nextEntityId('customer', 'C', 3, data.customers), 'C009',
    'and keeps climbing even though nothing was saved');
  /* THE POINT OF THE COUNTER: deleting the highest record must not free
     its number, or the next customer inherits the deleted one's debt. */
  data.customers = [];
  eq(scope.nextEntityId('customer', 'C', 3, data.customers), 'C010',
    'deleting every record does NOT rewind the counter');

  // A record sitting above the counter is respected too.
  data.customers = [{ id: 'C500' }];
  eq(scope.nextEntityId('customer', 'C', 3, data.customers), 'C501',
    'an id above the counter raises it rather than colliding');

  // Ids that are not of this shape are ignored rather than parsed wrongly.
  data.idCounters = {}; data.customers = [{ id: 'WALK-IN' }, { id: 'C004' }];
  eq(scope.nextEntityId('customer', 'C', 3, data.customers), 'C005',
    'an id of another shape is skipped, not read as a number');
}

/* ---------- 2. the quote screen uses the same allocator -------------- *
 * THE BUG. length+1 proposes from far below the range in use, so every
 * gap a deletion left is offered again.
 */
{
  realShop();
  const first = scope.generateCustomerId();
  eq(first, 'C1000', 'the quote screen clears every id on file, not the record COUNT');
  eq(scope.generateCustomerId(), 'C1001', 'and is monotonic across calls');
  t.check(!/data\.customers\.length \+ 1/.test(extractFunction(src, 'generateCustomerId', 'index.html')),
    'it no longer counts records to decide an id');
  t.check(/return nextEntityId\('customer', 'C', 3, data\.customers\);/
    .test(extractFunction(src, 'generateCustomerId', 'index.html')),
    'it goes through the one allocator, so there is no second scheme to drift');

  /* The failure this prevents, stated as a case: a customer is deleted
     and the number they held must not come back. */
  realShop();
  data.customers = data.customers.filter((c) => c.id !== 'C999');
  t.check(scope.generateCustomerId() !== 'C999',
    'a deleted customer\'s id is not handed to the next one');
}

/* ---------- 3. a collision is resolved, never reported --------------- */
{
  realShop();
  eq(scope.firstFreeEntityId('C', 3, data.customers, 'C1200'), 'C1200',
    'an id nothing is using is handed back untouched');
  eq(scope.firstFreeEntityId('C', 3, data.customers, 'C100'), 'C1000',
    'a taken id becomes the first number ABOVE everything on file');
  /* Not merely the next free hole: C103 is free, and using it would be
     reissuing a number a deleted customer may have held. */
  realShop();
  t.check(scope.firstFreeEntityId('C', 3, data.customers, 'C100') !== 'C103',
    'never a gap inside the used range, however free it looks');
  eq(data.idCounters.customer, 1000,
    'and the counter is carried up, so the next open does not propose it again');

  // Works for every prefix the app issues.
  data.suppliers = [{ id: 'S001' }, { id: 'S002' }];
  eq(scope.firstFreeEntityId('S', 3, data.suppliers, 'S001'), 'S003', 'suppliers too');
  eq(scope.firstFreeEntityId('ST', 3, [{ id: 'ST001' }], 'ST001'), 'ST002', 'and staff');
  eq(scope.firstFreeEntityId('P', 3, [], 'P001'), 'P001', 'nothing on file, nothing to avoid');
}

/* ---------- 4. no save handler dead-ends any more --------------------- */
{
  t.check(!/is taken\)\. Reload and try again/.test(src),
    'no form tells somebody to reload when an id collides — reloading proposes the same id');
  [['Customer', 'C', 'data.customers'], ['Supplier', 'S', 'data.suppliers'],
   ['Staff', 'ST', 'data.staff'], ['Product', 'P', 'data.products']].forEach(([kind, prefix, arr]) => {
    const rx = new RegExp(`if\\(!editing${kind}Id\\) id = firstFreeEntityId\\('${prefix}', 3, ${arr.replace('.', '\\.')}, id\\);`);
    t.check(rx.test(code), `${kind.toLowerCase()} saves through the collision fix rather than refusing`);
  });
}

/* ---------- 5. the collision fix must be able to RUN ----------------- *
 * Caught live, after every check above was already green: `id` was
 * declared const, so reassigning it threw "Assignment to constant
 * variable" and took the whole save handler down with it. The form did
 * nothing at all -- no toast, no record, no error a shopkeeper could
 * read. Every test in this file passed throughout, because they read the
 * source and exercise the helper, and neither of those runs the handler.
 *
 * So: the four handlers that reassign `id` must declare it reassignable,
 * and the file must not be able to drift back.
 */
{
  [['c_id', 'Customer'], ['s_id', 'Supplier'], ['st_id', 'Staff'], ['p_id', 'Product']]
    .forEach(([field, kind]) => {
      // The declaration belonging to this handler is the last one before
      // its collision line.
      const guard = code.indexOf(`if(!editing${kind}Id) id = firstFreeEntityId(`);
      t.check(guard > -1, `${kind.toLowerCase()} still resolves collisions`);
      if (guard < 0) return;
      const declLet = code.lastIndexOf(`let id = document.getElementById('${field}')`, guard);
      const declConst = code.lastIndexOf(`const id = document.getElementById('${field}')`, guard);
      t.check(declLet > -1 && declLet > declConst,
        `${kind.toLowerCase()}'s id is declared reassignable, or the save handler throws on every use`);
    });

  /* Belt and braces on the whole file: a reassignment of any const would
     throw the same way, and this is the shape that did it. */
  const badPairs = [...code.matchAll(/const (\w+) = document\.getElementById\([^)]*\)\.value[^\n]*\n([\s\S]{0,900}?)\n\}\);/g)]
    .filter((m) => new RegExp(`(^|[^\\w.])${m[1]} = `, 'm').test(m[2]));
  t.check(badPairs.length === 0,
    `no handler reassigns a const it read from a field (${badPairs.map((m) => m[1]).join(', ') || 'none'})`);
}

process.exit(t.done() ? 1 : 0);
