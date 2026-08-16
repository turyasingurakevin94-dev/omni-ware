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
  'closeFollowUp', 'reopenFollowUp', 'followUpAlreadyBought'];

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
  catalogueSellAtQty: () => (data.__sellPrice == null ? null : { price: data.__sellPrice }),
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

  const wire = extractFunction(src, 'wireFollowUpsScreen', 'index.html');
  t.check(/window\.open\(followUpWaUrl\(row\)[\s\S]{0,200}toast\(/.test(wire)
    && !/window\.open\(followUpWaUrl[\s\S]{0,200}recordFollowUpContact/.test(wire),
    'opening the chat records NOTHING — a chat opened is not a message sent, and a stamp saying the client knows when they were never told is worse than no stamp');
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
    'renderFollowUpAddResults'].map((n) => extractFunction(src, n, 'index.html')).join('\n');
  const used = [...new Set(
    (fns.match(/class="[^"$]*"/g) || []).map((m) => m.replace(/class="|"/g, '')).join(' ').split(/\s+/).filter(Boolean)
  )];
  const ALLOWED = ['btn', 'preset-hint', 'good', 'warn', 'closed'];
  const stray = used.filter((c) => !c.startsWith('fup-') && !ALLOWED.includes(c) && !c.startsWith('btn-'));
  t.check(stray.length === 0,
    `every class the follow-up screens render is fup- prefixed (stray: ${stray.join(', ') || 'none'})`);
  ['good', 'warn', 'closed'].forEach((m) => {
    t.check(!new RegExp(`^\\s*\\.${m}\\{`, 'm').test(code),
      `.${m} is never a rule on its own, so using it here cannot restyle anything else`);
  });
  /* And from the other side: the prefix check above only reads the
     MARKUP, so renaming a rule in the stylesheet left the class unstyled
     with every assertion still passing. The structural few are named
     here, so losing one is a failure rather than a silent flattening. */
  ['fup-card', 'fup-item', 'fup-pill', 'fup-row', 'fup-link'].forEach((c) => {
    t.check(new RegExp(`^\\s*\\.${c}\\{`, 'm').test(code),
      `.${c} has a rule of its own — without it the class renders as unstyled text and nothing else would notice`);
  });
}

/* ---------- 11. the three capture points ------------------------------ */
{
  t.check(/id="cstFollowBtn"/.test(code) && /openFollowUpListModal\(fup\.dataset\.id\)/.test(code),
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

/* ---------- 12. the badge counts messages, not rows ------------------- */
{
  const badge = extractFunction(src, 'renderFollowUpBadge', 'index.html');
  t.check(/followUpClientsToContact\(Date\.now\(\)\)\.length/.test(badge),
    'the badge counts CLIENTS to contact — one client owed three updates is one message, and counting rows would promise three');
}

process.exit(t.done() ? 1 : 0);
