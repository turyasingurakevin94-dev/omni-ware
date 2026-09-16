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
  'followUpSinceMs', 'followUpPriceNow', 'stockCrossedInSince', 'followUpBackInStock',
  'followUpCompanionIn', 'followUpSourcingProgress',
  'followUpPriceMoved', 'followUpGoneQuiet', 'followUpReasons', 'followUpClientsToContact',
  'followUpDigest', 'findFollowUp', 'addFollowUp', 'recordFollowUpContact',
  'closeFollowUp', 'reopenFollowUp', 'followUpBoughtSince', 'followUpAlreadyBought',
  // The promised day and the crossings index, which followUpReasons and
  // followUpClientsToContact now reach for.
  'followUpPromised', 'followUpStanding', 'stockCrossingsByKey',
  'setFollowUpPromise', 'setFollowUpDetails', 'unrecordFollowUpContacts'];

let nextId = 1;
const scope = compileScope([
  extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
  extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
  extractDeclaration(src, 'FOLLOW_UP_QUIET_DAYS_DEFAULT', 'index.html'),
  extractDeclaration(src, 'FOLLOW_UP_STAGE_WORDS', 'index.html'),
  extractDeclaration(src, 'fupDayISO', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  fmtShortDate: (iso) => String(iso || '').slice(0, 10),
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
  /* What the shop wrote down about a product, as the one reader returns
     it: nothing unless a check below writes some down. */
  pairCompanionsFor: (pid, idx) => (data.__companions || {})[pid + '::' + (idx == null ? '' : idx)] || [],
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
     chat records nothing. What changed twice is where the send lives.
     First it grew a box the owner can edit before sending -- and an app
     that shows you words, lets you change them and then sends the
     unedited ones has made that box a decoration -- so the url took the
     text as an argument. Then the pane became the recipient panel and
     followUpWaUrl, a one-line wrapper over waComposeUrl whose only
     caller was the pane, went with it. The panel calls waComposeUrl
     itself, which is the same claim with one fewer name in it. */
  const side = extractFunction(src, 'renderMessageSide', 'index.html');
  /* Scoped to the handler's own body. A window of N characters reaches
     past the closing brace into the NEXT handler, which is where the
     stamp legitimately lives -- so a range match here would fail on a
     correct screen and, worse, could pass on a wrong one. */
  const sendFn = (side.match(/send\.onclick = \(\)=>\{[\s\S]*?\n  \};/) || [''])[0];
  t.check(/window\.open\(waComposeUrl\(/.test(sendFn) && !/recordFollowUp/.test(sendFn),
    'opening the chat records NOTHING — a chat opened is not a message sent, and a stamp saying the client knows when they were never told is worse than no stamp');
  t.check(/window\.open\(waComposeUrl\(r\.phone \|\| '', box \? box\.value : body\)/.test(sendFn),
    'and it sends the words on the screen, not the ones the digest would have written — the box is editable, so it has to be the box that goes');
  /* And the other half of the same law, which the old screen got wrong
     in the opposite direction: "I told them" sat beside "Message" as a
     PEER, so it could be pressed having sent nothing at all. The pane
     answered that with fupAwaiting -- a footer that redrew itself into a
     question after the chat opened. The panel does not need the state:
     the send, the sentence saying the app cannot see WhatsApp, and the
     two stamps are one block in that order, so the question is asked
     every time and is never a peer of the send. */
  t.check(/cannot see WhatsApp[\s\S]{0,400}id="msg_was_sent"[\s\S]{0,200}id="msg_not_sent"/.test(side),
    'and the send asks afterwards whether it went, rather than offering "I told them" as a button beside it');
  const sentFn = (side.match(/sent\.onclick = \(\)=>\{[\s\S]*?\n  \};/) || [''])[0];
  t.check(/recordFollowUpClient\(r\.customerId/.test(sentFn)
    && /not\.onclick = \(\)=> toast\('Nothing recorded/.test(side),
    'with the stamp written only by the one that says it went, and nothing at all by the one that says it did not');
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
  /* WHAT IS LEFT TO CHECK, AND WHY IT IS STILL WORTH CHECKING.
     This list used to name renderFollowUpsContact, renderFollowUpsAll and
     renderFollowUpSummary — the three renderers of the second tab. That
     tab is gone and so are they: the queue, the strip, the work pane and
     the register are the Messages screen now, drawn in the .om- layer
     whose own gate (design-system.test.js) is a harder version of this
     one — every selector prefixed, every colour a token, every size on a
     ramp, and the palette closed at a number that may only fall.
     What still answers to THIS rule is what still renders fup- markup:
     the follow-up list modal, its add-results rows, and the rules-and-
     measurement panel that the Sent group opens. The rule has not moved
     an inch — a NEW bare or colliding family is still a stray, and the
     three screens that would have introduced one are the three that no
     longer exist. */
  const fns = ['renderFollowUpListModal', 'renderFollowUpAddResults', 'renderFollowUpScore']
    .map((n) => extractFunction(src, n, 'index.html')).join('\n');
  const used = [...new Set(
    (fns.match(/class="[^"$]*"/g) || []).map((m) => m.replace(/class="|"/g, '')).join(' ').split(/\s+/).filter(Boolean)
  )];
  /* ow- IS NOT A STRAY PREFIX, IT IS THE HOUSE.
     This list used to name dir-summary-card as one borrowed class, on
     the argument that a third opinion about what a summary tile looks
     like is what makes a screen read as bolted on. That argument is why
     the OW layer exists, and what is left of this screen is built on it:
     the panel, the side row and the mini note are the same ones Chase
     debts and What to buy draw. */
  /* tl-sc, tl-sc-l and tl-bar are Worth telling's scoreboard bar, and
     the measurement panel draws three of them. Borrowing it is the
     point: a second opinion about what "57 of 184" looks like is what
     makes a panel read as bolted on. Named here rather than pattern-
     matched, so a fourth borrowed family has to be argued for. */
  const ALLOWED = ['btn', 'preset-hint', 'good', 'warn', 'closed', 'tl-sc', 'tl-sc-l', 'tl-bar'];
  const stray = used.filter((c) => !c.startsWith('fup-') && !c.startsWith('ow-')
    && !ALLOWED.includes(c) && !c.startsWith('btn-'));
  t.check(stray.length === 0,
    `every class the follow-up markup renders is fup- prefixed or the layer's (stray: ${stray.join(', ') || 'none'})`);
  ['good', 'warn', 'closed'].forEach((m) => {
    t.check(!new RegExp(`^\\s*\\.${m}\\{`, 'm').test(code),
      `.${m} is never a rule on its own, so using it here cannot restyle anything else`);
  });
  /* And from the other side: the prefix check above only reads the
     MARKUP, so renaming a rule in the stylesheet left the class unstyled
     with every assertion still passing. The structural few are named
     here, so losing one is a failure rather than a silent flattening. */
  /* .fup-work, .fup-it and .fup-w-foot named the work pane — the client
     being worked, one thing they were waiting on, and the footer Send
     sat in. The pane is the recipient panel now and its rules went with
     it, so naming them here would be pinning three empty selectors and
     calling it structure. What this screen still OWNS is the settling
     row: the modal's line, the two halves of it, and the quiet Close.
     Losing a rule for one of them is still a silent flattening, which is
     the whole point of naming them. */
  ['fup-row', 'fup-row-main', 'fup-row-who', 'fup-link', 'fup-check'].forEach((c) => {
    t.check(new RegExp(`^\\s*\\.${c}\\{`, 'm').test(code),
      `.${c} has a rule of its own — without it the class renders as unstyled text and nothing else would notice`);
  });
  /* THE DELETION ITSELF, asserted rather than assumed. Code nothing
     calls is code the next reader has to prove is dead before they can
     change anything near it, and an unreachable renderer that still
     compiles is the easiest thing in this file to leave behind. */
  ['renderFollowUpsContact', 'renderFollowUpsAll', 'renderFollowUpSummary',
   'followUpStatePill', 'fupRowLenses', 'fupRowChip', 'fupCp', 'fupDaysQuiet'].forEach((n) => {
    t.check(!new RegExp(`^\\s*(function ${n}\\b|const ${n} *=)`, 'm').test(src),
      `${n} is gone, not merely unreachable — the second tab took its renderers and their private helpers with it`);
  });
  /* And the rules they wore went too. A selector nothing renders is a
     rule that cannot be tested by looking at the screen, which is how
     .fup-link.fup-act survived needing a class that no longer existed. */
  ['fup-work', 'fup-it', 'fup-w-foot', 'fup-w-head', 'fup-tel', 'fup-mt', 'fup-acts', 'fup-send'].forEach((c) => {
    t.check(!new RegExp(`\\.${c}[{ ,:]`).test(code),
      `.${c} has no rule left either — the pane's stylesheet went with the pane`);
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
  /* WHERE SEND IS NOW, AND WHY THE ASSERTION MOVED WITH IT. This pair
     used to read .fup-w-foot .btn{min-height:var(--ow-tap)} and
     .fup-w-foot .btn-accent{flex:1 1 100%;order:9} — every button in the
     work pane's footer a thumb tall, with Send taking the full width
     last. The footer is the recipient panel's send block now, in the
     .om- layer, and the phone does not reflow it: .om-ph-detail is a
     design of its own, so the heights are stated outright rather than
     inherited from a desktop rule with a minimum bolted on.
     The claim is the same claim and it is a stronger form of it — the
     old rule could only say "at least 44"; this says the send is 48 and
     the two stamps that follow it are 44, which is what the frame draws.
     And it is still Send that has to clear it, which is the part the
     original assertion existed for. */
  t.check(/\.om-ph-detail \.om-btn-w\{height:48px ?!important/.test(code),
    'on a phone the send is 48px tall — stated in the phone’s own design rather than reflowed out of the desktop’s');
  t.check(/\.om-ph-detail #msg_was_sent,\.om-ph-detail #msg_not_sent\{height:44px ?!important/.test(code),
    'and the two stamps under it are a full tap target each, which is what the owner presses when they come back');
  t.check(/id="msg_send" style="height:40px;width:100%"/.test(code),
    'and the send takes the whole width, where a thumb already is');
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
  /* THE ROW IS THE CARD NOW. renderFollowUpsContact drew a card whose
     heading was the item and whose second line was the reason; the
     Messages row draws the client and then one line saying what the
     message is about, which is the same two-part shape with the client
     in the heading instead of the item. So the short/full split is
     unchanged and it is msgReasonWords that makes it — still falling
     back to the full text rather than going blank, which is the part
     this assertion was really protecting. */
  const words = extractFunction(src, 'msgReasonWords', 'index.html');
  t.check(/esc\(why\.short \|\| why\.text\)/.test(words),
    'and the row renders the short form, falling back rather than going blank');
  const digest = extractFunction(src, 'followUpDigest', 'index.html');
  t.check(/r\.text/.test(digest) && !/r\.short/.test(digest),
    'while the message keeps the full one');
}

/* ---------- 11bis. silence that is patience, and silence that is work - */
{
  /* THE PILL IS GONE AND ITS QUESTION IS NOT.
     followUpStatePill read "Never told" in amber from the moment a
     follow-up was made, which told the owner off twenty minutes after
     they had done the right thing, for not saying something there was
     nothing to say. Two situations wanting opposite reactions wore one
     label, and the fix was to ask followUpReasons — "is there anything
     to tell them today" — instead of asking the clock.

     The pill drew on the register, the register is the Messages queue's
     Sent group, and a four-state chip on every row is not what that
     screen draws: membership of the queue IS the state now. So the pill
     was three lines of derivation over engines that all survive, and
     these assertions go to those engines directly — which is where the
     rule always lived, and where a regression would actually happen.

       Waiting    no reasons, never told → not in the queue at all
       Not told   reasons → in the queue, which is the only amber there is
       Told       told, nothing outstanding since → out of the queue and
                  into the Sent group, which msgSentLog draws
       Closed     closedAt → fupClosedLabel, on their own follow-up list

     Stated as a claim rather than as a label: nothing is ever put in
     front of the owner as work because time passed and no news came. */
  reset();
  // A day old, well inside the 14-day quiet threshold, so the only thing
  // that can change its state is real news.
  const fresh = fu({ createdAt: ago(1) });
  eq(scope.followUpReasons(fresh, NOW).length, 0,
    'nothing has happened yet, so nothing was said — that is patience, not a failure, and the queue does not ask for it');
  t.check(!scope.followUpLastContact(fresh),
    'and it is not "told" either — it is simply waiting, which is the state that used to be painted as a failure');

  stockMove(0, 20, 0);                       // now there IS something to say
  t.check(scope.followUpReasons(fresh, NOW).length > 0,
    'once the goods are in and nobody has rung, that is work — and work is the only thing the queue carries');

  fresh.contacts.push({ at: new Date(NOW).toISOString(), reason: 'back_in_stock' });
  eq(scope.followUpReasons(fresh, NOW).length, 0,
    'told, and nothing outstanding since — so it leaves the queue');
  t.check(!!scope.followUpLastContact(fresh),
    'and it is told rather than merely quiet, which is what puts it in the Sent group instead');

  fresh.closedAt = new Date(NOW).toISOString();
  t.check(!scope.followUpIsOpen(fresh), 'and a settled one is simply closed');
  const closedLabel = extractFunction(src, 'fupClosedLabel', 'index.html');
  t.check(/closedReason/.test(closedLabel) && /'Closed'/.test(closedLabel),
    'with the word for it written on their own follow-up list, where a settled row is still readable');
}
{
  // Silence that has gone on long enough IS work, even with no news.
  reset();
  const old = fu({ createdAt: ago(40) });
  t.check(scope.followUpReasons(old, NOW).some((r) => r.kind === 'gone_quiet'),
    '40 days of nothing is not patience — the quiet rule says so, and it is the rule the queue reads');
}
{
  // Told once, then news again: still owed a word.
  reset();
  const f = fu({ contacts: [{ at: ago(10), reason: 'x' }] });
  stockMove(0, 8, 2);
  t.check(scope.followUpReasons(f, NOW).length > 0,
    'told before is not told about THIS — a client already spoken to can still be owed the next update');
}

/* ---------- 11c. the screen reads before it is read ------------------- */
{
  /* THE THREE PANES ARE ONE SCREEN NOW, so the three extractions are
     three different ones. renderFollowUpSummary's five tiles are the
     figure cards, renderFollowUpsAll's grouped register is the queue
     itself with its Sent group, and renderFollowUpsContact's work pane
     is the recipient panel. Each assertion below says what it used to
     mean and what it means at the new address. */
  const kpis = extractFunction(src, 'renderMessageKpis', 'index.html');
  const screen = extractFunction(src, 'renderMessages', 'index.html');
  const side = extractFunction(src, 'renderMessageSide', 'index.html');

  /* COUNTED, NOT MERELY PRESENT, and the count changed on purpose.
     Three borrowed .dir-summary-card boxes said "Clients to message /
     Being watched / Never followed up", and only the first was a
     decision. Five of the layer's own tiles replaced them and named the
     composition of the work. The frame this screen is built from draws
     THREE cards, and the middle one has no figure at all — it exists so
     the other counts do not have to be printed as noughts. That is the
     same argument the five were making, carried one step further: a tile
     reading 0 is not a reading, it is a box. So the number is still
     asserted rather than a substring — one card swapped for something
     else is exactly the inconsistency a strip exists to avoid. */
  eq((kpis.match(/<div class="om-kpi["$]/g) || []).length, 3,
    'there are three figure cards — the frame’s own count, not a strip that grew a tile every time something else was worth saying');
  t.check(/NO FIGURE ON THIS ONE, on purpose/.test(kpis) && /om-kpi-w/.test(kpis),
    'and the middle one carries words rather than a figure, because a 0 on it would put back exactly what it was made to remove');
  ['To message', 'Everything else is clear', 'Chases that got paid'].forEach((k) => {
    t.check(kpis.includes(k), `the cards name ${k.toLowerCase()} — what the work IS, not a count of rows`);
  });

  /* THE STRIP CANNOT DISAGREE WITH THE QUEUE BENEATH IT. The old form of
     this was `counts[r.kind]` and a shared fupRowLenses: one reading of
     one row, feeding both the figure and the filter it opened. The
     reading is followUpHubRows now, computed ONCE per render and handed
     to the cards and the list as the same array — which is a stronger
     guarantee than two call sites agreeing, because there is only one. */
  t.check(/const rows = followUpHubRows\(now, chase\);/.test(screen),
    'the hub rows are computed once per render');
  /* TELLING LEFT THE HUB, and the claim is unchanged for the lens this
     section is about. The Money lens's cards and list are still handed
     the one array. Telling ranks on the opposite of what Money ranks on
     -- soonest to stop being true, never an amount -- so it has an
     engine of its own, and that engine is walked ONCE per render too,
     feeding its chip, its badge share, its sweep and its view. Two
     readings of one question is the fault; one reading each of two
     different questions is not. */
  t.check(/renderMessageKpis\(rows, money, telling, held\)/.test(screen)
       && /const money = rows\.filter\(/.test(screen),
    'and the cards and the list are handed that same array — the figure on a card counts the rows the list is drawn from, because it is the same rows');
  t.check(/const tellAll = msgTellRows\(now\);/.test(screen)
       && /const telling = tellAll\.filter\(r=> r\.route === 'tell'\);/.test(screen),
    'and the telling lens is walked once per render too, so its chip cannot say 3 over a list of 4');
  t.check(/rows\.filter\(r=> r\.kinds\.has\('promised'\)\)/.test(kpis),
    'and the composition is counted from the hub’s own kinds, so a card can never name work the queue is not showing');

  /* KEYED ON THE CUSTOMER AND NOTHING ELSE. `byCustomer` being mentioned
     proved nothing: a map keyed per row still has the name and still
     builds groups, it just builds one per item — which is the flat list
     again wearing a group's clothes. renderFollowUpsAll did that
     grouping itself; followUpHubRows does it for every engine now, which
     the hub test proves row by row. What this screen has to get right is
     narrower and it is checked here: ONE row per hub row, so a client
     owed three updates is one line and one message. */
  t.check(/lensRows\.map\(r=> msgRowHTML\(r\)\)/.test(screen),
    'the list draws one row per client — the flat one repeated a name down the page while splitting the two things one person was waiting for');
  t.check(/msgGroupHTML\('Held back'/.test(screen) && /msgGroupHTML\('Sent'/.test(screen),
    'and the states are groups inside that one list rather than tabs beside it — two renderings of one queue disagree the moment one is refreshed and the other is not');

  /* The initials used to be a private 38px square painting the brand
     accent on navy -- 2.7:1 at 14px bold, which is under the floor and
     was the worst pairing in the app on a phone in daylight. .om-av is
     the same idea in the card system's hands, and it passes. */
  t.check(/nameInitials/.test(side) && /om-av/.test(side),
    'a client is shown with the system’s initials, not a private square painting the accent on navy');

  /* NO PHONE NUMBER IS STILL A BLOCKER, and it is still said in three
     places at once rather than in one amber band below the items: on the
     contact line where the number would be, in the phone's own head
     where the name is, and by the absence of Send itself. The banner
     said it loudest; this says it where the reader is already looking,
     and -- the part the banner could not do -- it makes the missing
     button explicable instead of mysterious.
     This one caught a real regression: the redesign drew the send
     unconditionally, so a client with no number got a button that opened
     wa.me/ with nothing in it and failed inside WhatsApp, where this
     screen cannot see it. */
  const head = extractFunction(src, 'renderMessagePhoneHead', 'index.html');
  t.check(/no phone number on file/.test(side) && /om-caution-ink/.test(side),
    'no phone number is named where the number would be, in the caution ink');
  t.check(/no number on file/.test(head),
    'and again in the phone’s own head, which is the only place the name appears at 390px');
  t.check(/\$\{r\.phone \? `<button type="button" class="om-btn om-btn-w" id="msg_send"/.test(side),
    'and Send is withheld rather than offered and then failing — which is what makes the other two lines an explanation');
  t.check(/No number to send it to/.test(side),
    'with the gap named where the button would have been, so the missing control is legible rather than mysterious');

  /* THE ACCENT APPEARS ONCE. The old screen put an oxide "Message on
     WhatsApp" on every card and painted every avatar in it too: at this
     shop's fourteen clients that is twenty-eight oxide elements on a
     screen whose rule is that the accent means the one thing to do next.
     In the card system the accent is the coral .om-btn-p, and the only
     things wearing it are the confirms on the two small forms — which
     cannot both be open, because opening either closes the other. The
     send is not the accent at all: it is WhatsApp's own green, which is
     the one place in this app a brand colour is the honest signal. */
  const panelForm = extractFunction(src, 'msgPanelFormHTML', 'index.html');
  eq((panelForm.match(/om-btn-p/g) || []).length, 2,
    'the accent is drawn in exactly two branches — the hold’s confirm and the promise’s — and msgPanelForm can only be one of them at a time');
  t.check(!/om-btn-p/.test(side.replace(/\$\{msgPanelFormHTML\(r\)\}/g, '')),
    'and the panel itself carries none outside those two forms: with no form open there is no accent on the screen at all');
  t.check(/if\(msgPanelForm\) msgHeldForm = null;/.test(code)
       && /if\(msgHeldForm\) msgPanelForm = null;/.test(code),
    'and a form opening on a held row closes the panel’s, so two coral buttons saying different things can never share a screen');
  t.check(!/om-btn-p/.test(kpis), 'and the figure cards carry none at all: nothing on that side is an act');

  const linkRule = (code.match(/\.fup-link\{[^}]*\}/) || [''])[0];
  t.check(/color:var\(--ink-soft\)/.test(linkRule),
    'Close is quiet — in the brand accent it read as a destructive action, which it is not');
  t.check(/\.fup-link\.fup-inline\{[^}]*color:var\(--accent\)/.test(code),
    'while the one that sits inside a sentence still reads as a link');
}

/* ---------- 12. the badge counts messages, not rows ------------------- */
{
  /* The badge read followUpClientsToContact; it reads the hub now, which
     wraps that and adds the other engines' clients. Still CLIENTS: the
     hub keys its rows on the customer, which the hub test proves, and
     the telling engine keeps one row a person by the same law.

     WHAT IT NO LONGER COUNTS is anything that is not a word owed: a
     posting nomination is the algorithm's suggestion about a product, a
     held-back row is somebody deliberately not being asked today, and a
     better-posted row is a fact that reaches more people as a post. A
     badge that rises because a suggestion queue grew teaches people to
     ignore badges. */
  const badge = extractFunction(src, 'renderFollowUpBadge', 'index.html');
  t.check(/rows\.filter\(r=> r\.kinds\.has\('money'\)\)\.length/.test(badge)
    && /msgTellRows\(now\)\.filter\(r=> r\.route === 'tell'\)\.length/.test(badge),
    'the badge counts CLIENTS to contact — one client owed three updates is one message, and counting rows would promise three');
  t.check(/setNavBadge\('navBadgeFollowUps', money \+ telling/.test(badge),
    'and it is obligations only: money plus telling, and nothing that is merely worth considering');
  t.check(/renderFollowUpBadge\(\);/.test(extractFunction(src, 'refreshNavBadges', 'index.html')),
    'and it refreshes with every other badge — it used to start hidden until the tab was opened');
}

process.exit(t.done() ? 1 : 0);
