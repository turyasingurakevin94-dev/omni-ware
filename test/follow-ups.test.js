#!/usr/bin/env node
'use strict';
/*
 * Follow-ups: who is waiting to hear from us, and what is worth saying.
 *
 * A client in the field says "let me know when you get it". Until now
 * there was nowhere to put that, so it survived only in whoever heard it.
 *
 * The four things worth telling somebody, and why each is shaped the way
 * it is:
 *
 *   back in stock     keyed on the stock EVENT, not on "there is stock
 *                     now". An item that was never out has stock now too,
 *                     and a rule reading qty > 0 would report it on every
 *                     open, forever. What makes it news is the crossing
 *                     from nothing to something -- which qtyAfter and
 *                     delta together record exactly.
 *   sourcing moved    measured against the stage the client was TOLD
 *                     about, not the stage at capture: news is the gap
 *                     between what they know and what is true.
 *   price moved       silent unless a price was actually quoted to them.
 *                     With nothing on record there is nothing to have
 *                     moved from, and inventing a baseline from today's
 *                     figure would report every item as unchanged for
 *                     ever.
 *   gone quiet        the fallback, and deliberately last. Silence is
 *                     what actually kills a follow-up list, but a client
 *                     owed three real updates does not also need telling
 *                     that nobody has rung.
 *
 * Measured on the live shop before any of this was designed: items come
 * back into stock about 132 times a month, so a screen watching all stock
 * movement would be unreadable. Only what is on a list counts.
 *
 * Run: node test/follow-ups.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('follow-ups');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const DAY = 86400000;
const NOW = Date.parse('2026-08-16T10:00:00.000Z');
const ago = (days) => new Date(NOW - days * DAY).toISOString();

const data = {};
const NAMES = ['followUpsAll', 'followUpById', 'followUpIsOpen', 'openFollowUps',
  'followUpsForCustomer', 'followUpQuietDays', 'followUpSubject', 'followUpLastContact',
  'followUpSinceMs', 'followUpPriceNow', 'followUpBackInStock', 'followUpSourcingProgress',
  'followUpPriceMoved', 'followUpGoneQuiet', 'followUpReasons', 'followUpClientsToContact',
  'followUpDigest', 'findFollowUp', 'addFollowUp', 'recordFollowUpContact',
  'closeFollowUp', 'reopenFollowUp', 'followUpAlreadyBought', 'followUpStatePill'];

let nextId = 1;
const scope = compileScope([
  extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
  extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
  extractDeclaration(src, 'FOLLOW_UP_QUIET_DAYS_DEFAULT', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  saveData: () => {},
  allocRowId: () => nextId++,
  stockKey: (pid, idx) => pid + '::' + (idx == null ? '' : idx),
  getStockQty: (pid, idx) => Number(data.stock[pid + '::' + (idx == null ? '' : idx)]) || 0,
  productDisplayLabel: (p, idx) => p.name + (idx == null ? '' : ' ' + idx),
  // Records which basis it was asked for, so section 3b can check that
  // the choice is made the way a quote makes it.
  catalogueSellAtQty: (p, idx, qty, basis) => {
    data.__basisAsked = basis;
    return data.__sellPrice == null ? null : { price: data.__sellPrice };
  },
  rankedPurchaseRowsAtQty: () => (data.__purchaseRows || [{ purchasePrice: 1000, packQty: 0 }]),
  sourcingLeadById: (id) => (data.sourcingLeads || []).find((l) => l.id === id) || null,
  contactPhones: (c) => [c && c.phone, c && c.phone2].map((x) => String(x || '').trim()).filter(Boolean),
  waComposeUrl: (phone, msg) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
  fmtUGX: (n) => 'UGX ' + Number(n).toLocaleString('en-UG'),
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

function reset() {
  nextId = 1;
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, {
    followUps: [], customers: [{ id: 'C1', name: 'Musa Kato', phone: '0700111222' }],
    products: [{ id: 'P1', name: 'Cement 50kg' }],
    stock: {}, stockLog: [], sourcingLeads: [], savedQuotes: [],
    presetFollowUp: {}, __sellPrice: null,
  });
}
// A follow-up placed directly, so each section starts from a known shape
// rather than from whatever the previous one left behind.
const fu = (over) => {
  const f = Object.assign({
    id: nextId++, customerId: 'C1', productId: 'P1', variantIdx: null, leadId: null,
    qty: null, note: '', createdAt: ago(30), closedAt: null, closedReason: '', contacts: [],
  }, over);
  data.followUps.push(f);
  return f;
};
// before -> after, as the stock log actually records it.
const stockMove = (before, after, whenDays) => {
  data.stockLog.push({ key: 'P1::', delta: after - before, qtyAfter: after, at: ago(whenDays), date: ago(whenDays).slice(0, 10) });
  data.stock['P1::'] = after;
};

/* ---------- 1. back in stock keys on the EVENT ------------------------ */
{
  reset();
  const f = fu({});
  data.stock['P1::'] = 40;                        // plenty on the shelf…
  t.check(!scope.followUpBackInStock(f, NOW),
    '…but stock alone is not news — an item that was never out has stock too, and reading qty > 0 would report it on every open forever');

  stockMove(0, 40, 3);                            // …and here is the crossing
  const r = scope.followUpBackInStock(f, NOW);
  t.check(!!r, 'the arrival that took it from nothing to something IS news');
  eq(r && r.kind, 'back_in_stock', 'reported as such');
}
{
  reset();
  const f = fu({});
  stockMove(12, 40, 3);   // a top-up, not a return
  t.check(!scope.followUpBackInStock(f, NOW),
    'a delivery onto stock that was already there is not "back in stock" — they were never waiting');
}
{
  reset();
  const f = fu({});
  stockMove(0, 40, 3);
  data.stock['P1::'] = 0;   // arrived, then sold out again
  t.check(!scope.followUpBackInStock(f, NOW),
    'and it has to still be there NOW — sending somebody for goods that went yesterday is worse than saying nothing');
}
{
  reset();
  const f = fu({ contacts: [{ at: ago(1), reason: 'back_in_stock' }] });
  stockMove(0, 40, 3);      // the arrival was BEFORE we told them
  t.check(!scope.followUpBackInStock(f, NOW),
    'news that broke before the client was told is not news again afterwards');
}

/* ---------- 2. sourcing progress, against what they were told --------- */
{
  reset();
  data.sourcingLeads = [{ id: 'L1', name: 'Roofing nails 4in', status: 'asked' }];
  const f = fu({ productId: null, leadId: 'L1' });
  t.check(!scope.followUpSourcingProgress(f), 'a lead nobody has moved is not news');

  data.sourcingLeads[0].status = 'sourced';
  const r = scope.followUpSourcingProgress(f);
  t.check(!!r, 'finding who has it is');
  eq(r && r.status, 'sourced', 'and it carries the stage reached');

  f.contacts.push({ at: ago(1), leadStatusTold: 'sourced' });
  t.check(!scope.followUpSourcingProgress(f),
    'told once, it stops being news — the measure is against what they know, not against the start');

  data.sourcingLeads[0].status = 'listed';
  t.check(!!scope.followUpSourcingProgress(f), 'and moving further on is news again');

  // Leads DO go backward -- a source falls through, a price turns out to
  // be wrong. Telling a client "we now know what it costs" about a lead
  // that has just lost its price is worse than telling them nothing.
  f.contacts.push({ at: ago(1), leadStatusTold: 'listed' });
  data.sourcingLeads[0].status = 'looking';
  t.check(!scope.followUpSourcingProgress(f),
    'a lead sent BACK down the funnel is not progress — there is nothing good to report about losing ground');
}
{
  // The demotion case. lead.productId is set at graduation and nulled if
  // the lead is moved back off `listed`; a follow-up that had copied the
  // id would afterwards point at nothing.
  reset();
  data.products = [{ id: 'P9', name: 'Roofing nails 4in' }];
  data.sourcingLeads = [{ id: 'L1', name: 'Roofing nails 4in', status: 'listed', productId: 'P9' }];
  const f = fu({ productId: null, leadId: 'L1' });
  eq(scope.followUpSubject(f).kind, 'product', 'a graduated lead resolves to its product');
  eq(scope.followUpSubject(f).label, 'Roofing nails 4in', 'by name');

  data.sourcingLeads[0].status = 'priced';
  data.sourcingLeads[0].productId = null;      // exactly what demotion does
  eq(scope.followUpSubject(f).kind, 'lead',
    'and demoting the lead puts the follow-up back on the lead rather than stranding it on an id that is now null');
  eq(scope.followUpSubject(f).label, 'Roofing nails 4in', 'still naming the thing they asked for');
}

/* ---------- 3. price moved, only against a price they were given ------ */
{
  reset();
  const f = fu({});
  data.__sellPrice = 42000;
  t.check(!scope.followUpPriceMoved(f),
    'never quoted a price, so nothing can have moved — a baseline invented from today would report every item as unchanged for ever');

  f.contacts.push({ at: ago(5), priceToldUGX: 42000 });
  t.check(!scope.followUpPriceMoved(f), 'quoted, and unchanged, is not news either');

  data.__sellPrice = 38000;
  const down = scope.followUpPriceMoved(f);
  t.check(!!down && down.down === true, 'a drop is news, and is marked as a drop');
  eq(down.was, 42000, 'from what they were told');
  eq(down.now, 38000, 'to what it is');

  data.__sellPrice = 47000;
  const up = scope.followUpPriceMoved(f);
  t.check(!!up && up.down === false,
    'and so is a rise — they should hear it before ordering, not after');
}
{
  reset();
  const f = fu({ contacts: [
    { at: ago(9), priceToldUGX: 30000 },
    { at: ago(2), priceToldUGX: 42000 },   // the later one is the baseline
  ] });
  data.__sellPrice = 42000;
  t.check(!scope.followUpPriceMoved(f),
    'the baseline is the MOST RECENT price they were given, not the first');
}

/* ---------- 3b. the price is the one they would be QUOTED ------------- */
{
  /* This hard-coded 'retail'. quoteItemSellPrice -- how the app really
     prices a line -- chooses by quantity against pack size, and its own
     comment records that hard-coding 'retail' there was a bug: a shop
     with a wholesale markup on file never saw it applied. The same
     mistake here would measure every "price moved" against a figure the
     client would never have been charged. */
  reset();
  data.__sellPrice = 5000;
  data.__purchaseRows = [{ purchasePrice: 3000, packQty: 12 }];

  const small = fu({ qty: 4 });                 // under a pack
  scope.followUpPriceNow(small);
  eq(data.__basisAsked, 'retail', 'a few pieces are priced retail');

  const bulk = fu({ qty: 24 });                 // two packs
  scope.followUpPriceNow(bulk);
  eq(data.__basisAsked, 'wholesale',
    'a carton or more is priced wholesale — the same rule a quote uses, not a hard-coded retail');

  data.__purchaseRows = [{ purchasePrice: 3000, packQty: 0 }];
  const loose = fu({ qty: 500 });               // no pack size at all
  scope.followUpPriceNow(loose);
  eq(data.__basisAsked, 'retail', 'with no pack size there is no wholesale break to reach');
}
{
  // Never the buy price. quoteItemSellPrice falls back to it, which is
  // right on a quote where a human sees the line -- but this figure goes
  // straight out to the client in a message.
  reset();
  data.__purchaseRows = [{ purchasePrice: 3000, packQty: 0 }];
  data.__sellPrice = null;                       // no markup yields a price
  const f = fu({ qty: 1 });
  eq(scope.followUpPriceNow(f), null,
    'no markup means no price to quote — and NEVER the buy price, which would send the client our own cost');
  f.contacts.push({ at: ago(5), priceToldUGX: 4000 });
  t.check(!scope.followUpPriceMoved(f),
    'so nothing is reported as having moved either, rather than a move measured against a cost');
}

/* ---------- 4. gone quiet yields to real news ------------------------- */
{
  reset();
  const f = fu({ createdAt: ago(40) });
  const quiet = scope.followUpGoneQuiet(f, NOW);
  t.check(!!quiet, '40 days with nothing said is itself worth reporting');
  t.check(/never followed up/.test(quiet.text),
    'and it says which kind of silence — never contacted at all reads differently from overdue a chat');

  stockMove(0, 40, 1);
  const reasons = scope.followUpReasons(f, NOW);
  eq(reasons.length, 1, 'with real news present, only the news is reported');
  eq(reasons[0].kind, 'back_in_stock',
    'a client owed a real update does not also need telling that nobody has rung');
}
{
  reset();
  const f = fu({ createdAt: ago(3) });
  t.check(!scope.followUpGoneQuiet(f, NOW), 'three days is not silence');
  data.presetFollowUp = { quietDays: 2 };
  t.check(!!scope.followUpGoneQuiet(f, NOW), 'the threshold is a setting, because the right number depends on the shop');
}
{
  reset();
  const f = fu({ createdAt: ago(90), closedAt: ago(1), closedReason: 'bought' });
  eq(scope.followUpReasons(f, NOW).length, 0, 'a closed follow-up says nothing at all');
}

/* ---------- 5. one message per client --------------------------------- */
{
  reset();
  data.customers.push({ id: 'C2', name: 'Grace Namuli', phone: '0700333444' });
  data.products.push({ id: 'P2', name: 'Iron sheets' });
  // C2 follows a thing NOBODY else follows, so a digest that leaked other
  // clients' items would be caught by name. Giving them all the same item
  // made the leak invisible: the stray lines read identically to the
  // right ones.
  data.products.push({ id: 'P3', name: 'Wheelbarrow' });
  fu({ customerId: 'C1', productId: 'P1' });
  fu({ customerId: 'C1', productId: 'P2' });
  fu({ customerId: 'C2', productId: 'P3' });
  stockMove(0, 40, 1);
  data.stockLog.push({ key: 'P2::', delta: 20, qtyAfter: 20, at: ago(1), date: ago(1).slice(0, 10) });
  data.stock['P2::'] = 20;
  data.stockLog.push({ key: 'P3::', delta: 4, qtyAfter: 4, at: ago(1), date: ago(1).slice(0, 10) });
  data.stock['P3::'] = 4;

  const rows = scope.followUpClientsToContact(NOW);
  eq(rows.length, 2, 'one row per CLIENT, not per item');
  const musa = rows.find((r) => r.customerId === 'C1');
  eq(musa.items.length, 2, 'carrying everything that client is owed');

  const msg = scope.followUpDigest(musa);
  t.check(/Cement 50kg/.test(msg) && /Iron sheets/.test(msg),
    'and ONE message naming both — nobody sends somebody two WhatsApps in a row');
  t.check(/Musa/.test(msg), 'addressed to them');
  t.check(!/Wheelbarrow/.test(msg),
    'and carrying nothing belonging to another client — checked on an item only they follow, since a shared one hides the leak');
}
{
  reset();
  data.customers = [{ id: 'C1', name: 'Musa Kato', phone: '', phone2: '0700999888' }];
  fu({});
  stockMove(0, 5, 1);
  const row = scope.followUpClientsToContact(NOW)[0];
  eq(row.phone, '0700999888',
    'the number can be in phone2 — reading c.phone alone would open a blank chat with the number sitting one field over');
}

/* ---------- 6. telling them is not the same as opening WhatsApp ------- */
{
  reset();
  data.sourcingLeads = [{ id: 'L1', name: 'Roofing nails', status: 'priced' }];
  const f = fu({ productId: null, leadId: 'L1' });
  data.__sellPrice = 15000;
  eq(f.contacts.length, 0, 'nothing recorded yet');

  scope.recordFollowUpContact(f.id, 'sourcing_progress');
  eq(f.contacts.length, 1, 'recording a contact appends to the ledger');
  eq(f.contacts[0].leadStatusTold, 'priced',
    'stamping the stage they were told about, which is what the next comparison is made against');
  t.check(!scope.followUpSourcingProgress(f), 'so the same news is not reported twice');
}
{
  /* The price half of the same stamp, driven through the real writer
     rather than hand-built contacts. Built by hand, the tests above pass
     whether or not recordFollowUpContact records a price at all -- and
     with it recording null, a price could move for ever unseen. */
  reset();
  const f = fu({});
  data.__sellPrice = 42000;
  scope.recordFollowUpContact(f.id, 'manual');
  eq(f.contacts[0].priceToldUGX, 42000, 'the price they were quoted is stamped at the moment of telling');
  t.check(!scope.followUpPriceMoved(f), 'so nothing has moved yet');
  data.__sellPrice = 50000;
  t.check(!!scope.followUpPriceMoved(f),
    'and a later move is measured against it — without the stamp no move could ever be seen');
}
{

  /* THE LAW HERE IS UNCHANGED and it is the important one: opening a
     chat records nothing. What changed is the call's arity, because the
     message is now on the screen in a box the owner can edit before
     sending -- and an app that shows you words, lets you change them and
     then sends the unedited ones has made that box a decoration. So the
     url is built from what is actually in front of them, and the test
     asks for that too rather than for the no-argument form it used to
     pin. The second half of the assertion is the law and is untouched. */
  const wire = extractFunction(src, 'wireFollowUpsScreen', 'index.html');
  t.check(/window\.open\(followUpWaUrl\(row[\s\S]{0,200}toast\(/.test(wire)
    && !/window\.open\(followUpWaUrl[\s\S]{0,200}recordFollowUpContact/.test(wire),
    'opening the chat records NOTHING — a chat opened is not a message sent, and a stamp saying the client knows when they were never told is worse than no stamp');
  t.check(/window\.open\(followUpWaUrl\(row, draftOf\(/.test(wire),
    'and it sends the words on the screen, not the ones the digest would have written — the box is editable, so it has to be the box that goes');
  /* And the other half of the same law, which the old screen got wrong
     in the opposite direction: "I told them" sat beside "Message" as a
     PEER, so it could be pressed having sent nothing at all. It is asked
     as a consequence of the send now -- the footer changes after the
     chat opens -- which is what fupAwaiting is for. */
  t.check(/fupAwaiting = cid;/.test(wire) && /fup-notsent/.test(wire),
    'and the send asks afterwards whether it went, rather than offering "I told them" as a button beside it');
}

/* ---------- 7. what it refuses to record ------------------------------ */
{
  reset();
  t.check(scope.addFollowUp('C1', { productId: 'P1', leadId: 'L1' }) === null,
    'a follow-up on both a product and a lead is refused — every reader would have to pick one, and they would not all pick the same');
  t.check(scope.addFollowUp('C1', {}) === null, 'and one on neither cannot say what it is about');
  t.check(scope.addFollowUp('', { productId: 'P1' }) === null, 'nor one with no client');
  eq(data.followUps.length, 0, 'none of which leaves a row behind');

  const first = scope.addFollowUp('C1', { productId: 'P1', variantIdx: null }, {});
  const again = scope.addFollowUp('C1', { productId: 'P1', variantIdx: null }, {});
  eq(data.followUps.length, 1, 'the same client and the same thing twice is one row');
  t.check(first === again,
    'because two would put one item on two lines of one message, and closing one would leave the other still asking');

  scope.closeFollowUp(first.id, 'bought');
  const third = scope.addFollowUp('C1', { productId: 'P1', variantIdx: null }, {});
  eq(data.followUps.length, 2,
    'but asking again after it was settled is a new thing to follow, not a duplicate of the closed one');
  t.check(third !== first, 'and a fresh row');
}
{
  reset();
  scope.addFollowUp('C1', { productId: 'P1', variantIdx: 0 }, {});
  scope.addFollowUp('C1', { productId: 'P1', variantIdx: 1 }, {});
  eq(data.followUps.length, 2, 'two sizes of one product are two different things to wait for');
}

/* ---------- 8. did they already buy it -------------------------------- */
{
  reset();
  const f = fu({ createdAt: ago(20) });
  data.savedQuotes = [{
    id: 7, customerId: 'C1', invoiced: true, voided: false,
    invoicedTs: NOW - 2 * DAY, invoicedAt: ago(2),
    items: [{ productId: 'P1', variantIdx: null }],
  }];
  t.check(!!scope.followUpAlreadyBought(f), 'an invoiced order carrying the item is spotted');
  t.check(!!f.closedAt === false,
    'but nothing is closed automatically — a part delivery is not the end of it, and closing on their behalf would hide exactly the case worth looking at');

  data.savedQuotes[0].voided = true;
  t.check(!scope.followUpAlreadyBought(f), 'a voided order bought nothing');
}
{
  reset();
  const f = fu({ createdAt: ago(2) });
  data.savedQuotes = [{
    id: 7, customerId: 'C1', invoiced: true, voided: false,
    invoicedTs: NOW - 20 * DAY, invoicedAt: ago(20),
    items: [{ productId: 'P1', variantIdx: null }],
  }];
  t.check(!scope.followUpAlreadyBought(f),
    'a purchase from BEFORE they asked is not the answer to the asking');
}

/* ---------- 9. registered with the sync engine ------------------------ */
{
  t.check(/sel\('follow_ups'\)/.test(code), 'the table is loaded');
  t.check(/const followUpRows = \(followUpsR && !followUpsR\.error && followUpsR\.data\) \|\| \[\];/.test(code),
    'tolerantly — the code deploys on a push and the migration is applied by hand, so there is a window where one exists and the other does not');
  t.check(!/followUpsR[\s\S]{0,200}\.forEach\(r=>\{ if\(r\.error\) throw r\.error; \}\);/.test(code),
    'and it is not in the throw list, so a missing table cannot take the whole shop down');
  t.check(/followUps: keyRowsById\(rows\.followUps, 'id'\),/.test(code),
    'seeded into lastSynced, or the first close of a session is undone by the next load');
  t.check(/addDiffOps\(ops, 'followUps', 'follow_ups', 'id', shopId, rows\.followUps\);/.test(code),
    'diffed on save');
  t.check(/const absent = \[[^\]]*'followUps'[^\]]*\]\.filter\(k=> !data\[k\]\);/.test(code),
    'and an absent collection is refused rather than read as an instruction to empty it');
  t.check(/if\(!data\.followUps\) data\.followUps = \[\];/.test(code),
    'a backup from before this existed restores with an empty collection, not an absent one');
  const mig = read('supabase/migrations/0077_follow_ups.sql');
  t.check(/create table follow_ups/.test(mig), 'the table has a migration');
  t.check(/\(\(product_id is not null\) <> \(lead_id is not null\)\)/.test(mig),
    'and the one-subject rule is enforced by the database too, not only by addFollowUp');
  t.check(/'row:follow_up'/.test(mig) && /'row:follow_up'/.test(code),
    'ids come from the same block scheme as every other table');
}

/* ---------- 10. the CSS prefix, and the lesson behind it -------------- */
{
  /* `sc-` was already taken by supplier cards. A bare .sc-row rule
     restyled all 44 of their contact rows and a bare .sc-head won the
     cascade on document order, while every test passed. A prefix check is
     the only thing that catches that before somebody sees it. */
  const fns = ['renderFollowUpsContact', 'renderFollowUpsAll', 'renderFollowUpListModal',
    'renderFollowUpAddResults', 'renderFollowUpSummary']
    .map((n) => extractFunction(src, n, 'index.html')).join('\n');
  const used = [...new Set(
    (fns.match(/class="[^"$]*"/g) || []).map((m) => m.replace(/class="|"/g, '')).join(' ').split(/\s+/).filter(Boolean)
  )];
  /* dir-summary-card is the app's own summary strip, the one Suppliers and
     Customers already carry. Reusing it is the point -- a third opinion
     about what a summary tile looks like is exactly what makes a screen
     read as bolted on. Named here rather than pattern-matched so a fourth
     borrowed class has to be argued for. */
  /* ow- IS NOT A STRAY PREFIX, IT IS THE HOUSE.
     This list used to name dir-summary-card as one borrowed class, on
     the argument that a third opinion about what a summary tile looks
     like is what makes a screen read as bolted on. That argument is why
     the OW layer exists, and this screen is built on it now: the strip,
     the list row, the chip, the initials, the panel, the table and the
     message box are the same ones Chase debts and What to buy draw, and
     holding this screen to a private prefix would be holding it away
     from the very thing the prefix rule was protecting.
     What the rule was actually catching stays caught: a NEW bare or
     colliding family. Anything that is neither the layer nor this
     screen's own fup- is still a stray. */
  const ALLOWED = ['btn', 'preset-hint', 'good', 'warn', 'closed'];
  const stray = used.filter((c) => !c.startsWith('fup-') && !c.startsWith('ow-')
    && !ALLOWED.includes(c) && !c.startsWith('btn-'));
  t.check(stray.length === 0,
    `every class the follow-up screens render is fup- prefixed or the layer's (stray: ${stray.join(', ') || 'none'})`);
  ['good', 'warn', 'closed'].forEach((m) => {
    t.check(!new RegExp(`^\\s*\\.${m}\\{`, 'm').test(code),
      `.${m} is never a rule on its own, so using it here cannot restyle anything else`);
  });
  /* And from the other side: the prefix check above only reads the
     MARKUP, so renaming a rule in the stylesheet left the class unstyled
     with every assertion still passing. The structural few are named
     here, so losing one is a failure rather than a silent flattening. */
  /* .fup-card, .fup-item and .fup-pill are gone rather than renamed: the
     card wall they built is what this redesign removed, and a chip is
     the layer's .ow-cp on every other screen. The four below are what
     this screen still owns -- the client being worked, one thing they
     are waiting on, its footer, and the modal's rows and their quiet
     Close. Losing a rule for one of them is still a silent flattening,
     which is the whole point of naming them. */
  ['fup-work', 'fup-it', 'fup-w-foot', 'fup-row', 'fup-link'].forEach((c) => {
    t.check(new RegExp(`^\\s*\\.${c}\\{`, 'm').test(code),
      `.${c} has a rule of its own — without it the class renders as unstyled text and nothing else would notice`);
  });
}

/* ---------- 10b. it is used standing up, on a phone ------------------- */
{
  /* This screen exists for somebody in the field with a phone, so its
     controls are tapped. Measured in the browser at 375px: the Close
     button was 23px tall and the action buttons 31px, both under the 44
     a finger needs. The order board solved the same problem with an
     invisible ring rather than a slab in a dense row. */
  const ring = code.match(/\.fup-link::after\{content:"";position:absolute;inset:(-?\d+)px (-?\d+)px;\}/);
  t.check(!!ring, 'the row button has a hit area hung off it');
  if (ring) {
    const tall = 23 + Math.abs(Number(ring[1])) * 2;
    t.check(tall >= 44, `which brings it to ${tall}px, at or over the 44px minimum`);
  }
  t.check(/\.fup-link\{[^}]*position:relative;/.test(code),
    'and it is positioned, or the ring would hang off the page instead of the button');
  /* The 1000px block and .fup-acts went with the card wall. The rule it
     was enforcing did not: the buttons this screen is worked with must
     be a thumb tall on a phone. It is enforced at the layer's own
     breakpoint now, against the layer's own token, rather than against a
     padding figure measured once by hand -- and it is Send that has to
     clear it, which the old assertion could not say. */
  t.check(/@media \(max-width:820px\)\{[\s\S]*?\.fup-w-foot \.btn\{[^}]*min-height:var\(--ow-tap\)/.test(code),
    'and on a phone every button in the footer is a full tap target, measured against --ow-tap rather than a hand-counted padding');
  t.check(/\.fup-w-foot \.btn-accent\{[^}]*flex:1 1 100%[^}]*order:9;\}/.test(code),
    'with Send taking the full width, last, where a thumb already is');
}

/* ---------- 11. the three capture points ------------------------------ */
{
  /* The customer panel was a modal with its own button ids. It is a
     screen now, and every control on it is delegated through one
     listener -- so the capture point is the action rather than the id,
     which is the same guarantee with one listener instead of forty. */
  t.check(/data-cact="follow" data-cid=/.test(code)
       && /if\(name === 'follow'\) return openFollowUpListModal\(id\);/.test(code),
    'a client’s own record opens their list');
  t.check(/id="sl_ask2_follow"/.test(code) && /addFollowUp\(asker\.customerId, \{leadId: l\.id\}/.test(code),
    'a sourcing ask can enrol the asker');
  /* Anchored on the BRANCH, not on the words. The live hint below the
     tick uses the same phrase, so a search of the whole file passed
     happily with the branch that actually warns deleted. */
  t.check(/\} else if\(wantFollow\)\{[\s\S]{0,200}there is nobody to follow up with/.test(code),
    'and says so when no customer was matched — 8 of this shop’s 9 asks name nobody, which is exactly why an ask alone could never be followed up');
  t.check(/psl-follow/.test(code) && /wirePickShortfallFollowUps/.test(code),
    'a line that could not be filled offers to keep them posted');
}

/* ---------- 11b. the card says it once, the message says it in full --- */
{
  /* Found by looking at the rendered card: it printed the item name as
     the heading and then again inside the reason. The message needs the
     full name -- it goes to somebody with no screen in front of them --
     and the card does not. */
  reset();
  const f = fu({});
  stockMove(0, 12, 1);
  const r = scope.followUpBackInStock(f, NOW);
  t.check(/Cement 50kg/.test(r.text), 'the message names the item, since the client has no card to look at');
  t.check(!/Cement 50kg/.test(r.short || ''), 'the card form does not, because the name is on the line above it');
  const render = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  t.check(/esc\(r\.short \|\| r\.text\)/.test(render),
    'and the card renders the short form, falling back rather than going blank');
  const digest = extractFunction(src, 'followUpDigest', 'index.html');
  t.check(/r\.text/.test(digest) && !/r\.short/.test(digest),
    'while the message keeps the full one');
}

/* ---------- 11bis. the pill says WHICH kind of silence ---------------- */
{
  /* It read "Never told" in amber from the moment a follow-up was made,
     which told the user off twenty minutes after they had done the right
     thing, for not saying something there was nothing to say. Two
     situations wanting opposite reactions were wearing one label. */
  reset();
  // A day old, well inside the 14-day quiet threshold, so the only thing
  // that can change its state is real news.
  const fresh = fu({ createdAt: ago(1) });
  eq(scope.followUpStatePill(fresh, NOW).label, 'Waiting',
    'nothing has happened yet, so nothing was said — that is patience, not a failure');
  eq(scope.followUpStatePill(fresh, NOW).cls, '',
    'and it is not painted amber, or amber stops meaning anything');

  stockMove(0, 20, 0);                       // now there IS something to say
  eq(scope.followUpStatePill(fresh, NOW).label, 'Not told',
    'once the goods are in and nobody has rung, that is work');
  eq(scope.followUpStatePill(fresh, NOW).cls, 'warn', 'and it says so in amber');

  fresh.contacts.push({ at: new Date(NOW).toISOString(), reason: 'back_in_stock' });
  eq(scope.followUpStatePill(fresh, NOW).label, 'Told', 'told, and nothing outstanding since');
  eq(scope.followUpStatePill(fresh, NOW).cls, 'good', 'which is the only green state');

  fresh.closedAt = new Date(NOW).toISOString();
  eq(scope.followUpStatePill(fresh, NOW).label, 'Closed', 'and a settled one is simply closed');
}
{
  // Silence that has gone on long enough IS work, even with no news.
  reset();
  const old = fu({ createdAt: ago(40) });
  eq(scope.followUpStatePill(old, NOW).label, 'Not told',
    '40 days of nothing is not patience — the quiet rule already says so, and the pill now agrees with it');
}
{
  // Told once, then news again: still owed a word.
  reset();
  const f = fu({ contacts: [{ at: ago(10), reason: 'x' }] });
  stockMove(0, 8, 2);
  eq(scope.followUpStatePill(f, NOW).label, 'Not told',
    'told before is not told about THIS — a client already spoken to can still be owed the next update');
}

/* ---------- 11c. the screen reads before it is read ------------------- */
{
  const all = extractFunction(src, 'renderFollowUpsAll', 'index.html');
  const contact = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  const summary = extractFunction(src, 'renderFollowUpSummary', 'index.html');

  /* Counted, not merely present -- the argument for counting is
     unchanged, and it is why this still asserts a number rather than a
     substring: one tile swapped for something else is exactly the
     inconsistency a strip exists to avoid.
     What changed is what the tiles are. Three borrowed .dir-summary-card
     boxes said "Clients to message / Being watched / Never followed up",
     and only the first was a decision -- the third is a curiosity, and
     none of them said what today's work IS. Five of the layer's own
     tiles do: the size of the queue, and then its composition, which is
     the four reasons followUpReasons already computes. A strip that
     names the work is a triage line; one that counts rows is a header. */
  eq((summary.match(/class="ow-mt\$\{/g) || []).length, 1,
    'the tiles are the layer’s, drawn from one template rather than five copies of a box');
  eq((summary.match(/\$\{tile\(/g) || []).length, 5,
    'and there are five of them — the queue, and then what the queue is made of');
  ['To message', 'Goods arrived', 'Sourcing moved', 'Price changed', 'Gone quiet'].forEach((k) => {
    t.check(summary.includes(k), `the strip names ${k.toLowerCase()} — the composition of the work, not a count of rows`);
  });
  t.check(/counts\[r\.kind\]/.test(summary),
    'and the four are counted from followUpReasons itself, so the strip can never disagree with the queue beneath it');

  /* Keyed on the customer and NOTHING else. `byCustomer` being mentioned
     proved nothing: a map keyed per row still has the name and still
     builds groups, it just builds one per item -- which is the flat list
     again wearing a group's clothes. */
  t.check(/const key = String\(f\.customerId\);\s*\n\s*if\(!byCustomer\.has\(key\)\)/.test(all),
    'the full list groups by client alone — the flat one repeated a name down the page while splitting the two things one person was waiting for');
  t.check(/ow-tbl-g/.test(all), 'and renders them as groups — the layer’s group heading inside its table, not a private card');
  t.check(/followUpStatePill/.test(all) && /fupCp\(/.test(all),
    'and state is a chip, not a sentence in grey among other sentences in grey');

  /* The initials used to be a private 38px square painting the brand
     accent on navy -- 2.7:1 at 14px bold, which is under the floor and
     was the worst pairing in the app on a phone in daylight. .ow-av is
     the same idea in the layer's hands, and it passes. */
  t.check(/nameInitials/.test(contact) && /ow-av/.test(contact),
    'a client is shown with the layer’s initials, not a private square painting the accent on navy');

  /* NO PHONE NUMBER IS STILL A BLOCKER, and it is now said in three
     places at once rather than in one amber band below the items: on the
     contact line where the number would be, in the line addressing the
     message, and by the absence of Send itself. The banner said it
     loudest; this says it where the reader is already looking, and --
     the part the banner could not do -- it makes the missing button
     explicable instead of mysterious. */
  t.check(/fup-w-none/.test(contact) && /no phone number on file/.test(contact),
    'no phone number is named where the number would be, in the caution ink');
  t.check(/no number to send it to/.test(contact),
    'and again on the line that says where the message is going');
  t.check(/\$\{row\.phone \? `<button type="button" class="btn btn-accent fup-send"/.test(contact),
    'and Send is withheld rather than offered and then failing — which is what makes the other two lines an explanation');

  // Close is routine housekeeping. Painted in --accent it was a red, which
  // made the most ordinary action on the screen look like the worst one.
  /* THE ACCENT APPEARS ONCE. The old screen put an oxide "Message on
     WhatsApp" on every card and painted every avatar in it too: at this
     shop's fourteen clients that is twenty-eight oxide elements on a
     screen whose rule is that the accent means the one thing to do next.
     There is one now, and it is the send. */
  const oxide = (contact.match(/btn-accent/g) || []).length;
  eq(oxide, 2, 'the accent is drawn in exactly two branches — Send, and the confirmation that replaces it — so only ever one is on the screen');
  t.check(!/btn-accent/.test(all), 'and the register carries none at all: nothing on that side is an act');

  const linkRule = (code.match(/\.fup-link\{[^}]*\}/) || [''])[0];
  t.check(/color:var\(--ink-soft\)/.test(linkRule),
    'Close is quiet — in the brand accent it read as a destructive action, which it is not');
  t.check(/\.fup-link\.fup-inline\{[^}]*color:var\(--accent\)/.test(code),
    'while the one that sits inside a sentence still reads as a link');
}

/* ---------- 12. the badge counts messages, not rows ------------------- */
{
  const badge = extractFunction(src, 'renderFollowUpBadge', 'index.html');
  t.check(/followUpClientsToContact\(Date\.now\(\)\)\.length/.test(badge),
    'the badge counts CLIENTS to contact — one client owed three updates is one message, and counting rows would promise three');
}

process.exit(t.done() ? 1 : 0);
