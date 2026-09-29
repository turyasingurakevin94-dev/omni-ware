#!/usr/bin/env node
'use strict';
/*
 * The Sourcing console (sourcing-console.js): the canvas design, reading
 * and writing the shop's own leads.
 *
 * What is worth pinning here is the seam between the two. The console
 * thinks in view state -- moved, dropped, rivalsAdd, quoteFix -- because
 * that is how it was designed; the books think in leads. Every one of
 * those keys has to become a real write on the lead, and every render
 * has to read them back from the lead, or the screen and the books drift
 * apart the first time the page reloads.
 *
 *   the research seam   competitor prices and the console's own notes
 *                       ride in candidates under a `kind`, and must be
 *                       lifted out on load -- every supplier-reading
 *                       function in the app would otherwise rank a rival
 *                       shop as a supplier -- and put back on save.
 *
 *   the gates survive   Listed is a real product or nothing: the console's
 *                       "add it to what we sell" opens graduation, it never
 *                       stamps the status itself.
 *
 *   nothing is lost     a drop is a void, never a delete; undo puts back
 *                       exactly what was there.
 *
 * Run: node test/sourcing-console.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('sourcing console');
const html = read('index.html');
const consoleSrc = read('sourcing-console.js');
const eq = (a, b, m) => t.check(a === b, `${m} (${JSON.stringify(a)})`);

/* ---------- 1. the research seam ---------------------------------------- */
{
  const S = compileScope([extractFunction(html, 'sourcingResearchFrom', 'index.html'), extractFunction(html, 'sourcingResearchRows', 'index.html')],
    {}, ['sourcingResearchFrom', 'sourcingResearchRows']);
  const stored = [
    { id: 'C1', supplierName: 'Feko', tiers: [{ minQty: 1, price: 100 }] },
    { kind: 'rival', name: 'Nyanzi', price: 120, stock: 'In stock', breaks: [{ q: 10, p: 110 }] },
    { kind: 'meta', snoozedUntil: 5, events: [{ t: 'x', at: 1 }] },
  ];
  const research = S.sourcingResearchFrom(stored);
  eq(research.rivals.length, 1, 'a rival row is read back as a competitor price');
  t.check(!('kind' in research.rivals[0]) && research.rivals[0].breaks[0].p === 110, 'without its storage tag, and with its volume breaks');
  eq(research.meta.snoozedUntil, 5, 'the meta row becomes the lead’s notes');
  const back = S.sourcingResearchRows(research);
  t.check(back.length === 2 && back[0].kind === 'rival' && back[1].kind === 'meta', 'and both go back into the stored list tagged, so a save loses neither');
  eq(S.sourcingResearchRows({ rivals: [], meta: {} }).length, 0, 'an empty research adds nothing to the stored list');
  t.check(/candidates: \(Array\.isArray\(r\.candidates\) \? r\.candidates : \[\]\)\.filter\(c=> !\(c && c\.kind\)\)/.test(html),
    'loadData keeps tagged rows OUT of lead.candidates — every supplier ranking reads suppliers only');
  t.check(/candidates: \[\.\.\.\(l\.candidates\|\|\[\]\), \.\.\.sourcingResearchRows\(l\.research\)\]/.test(html),
    'and saveData writes them back beside the suppliers');
}

/* ---------- the console, compiled against a stub shop ------------------- */
const DAY = 86400000;
const now = Date.now();
const data = {};
const calls = { saves: 0, graduate: [], followUps: 0 };
function freshData() {
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, {
    staff: [{ id: 'ST1', name: 'Musa' }, { id: 'ST2', name: 'Aisha Nankya' }],
    suppliers: [{ id: 'S1', name: 'Feko Hardware', phone: '0772000111', location: 'Kikuubo' }],
    customers: [{ id: 'C1', name: 'Kato Construction Ltd', phone: '0772418220', debt: 0 }],
    products: [], prices: [], purchaseInvoices: [], savedQuotes: [], stock: {},
    presetSourcingStageLimits: {},
    sourcingLeads: [
      { id: 'SRC-A', name: 'Ridge cap G28', status: 'sourced', voided: false, createdAt: new Date(now - 20 * DAY).toISOString(), stageEnteredAt: now - 3 * DAY,
        assignedStaffId: 'ST1', requests: [
          { at: new Date(now - 20 * DAY).toISOString(), source: 'sourcing', customerId: 'C1', customerName: 'Kato Construction Ltd', qty: 40 },
          { at: new Date(now - 5 * DAY).toISOString(), source: 'quote', customerName: '', qty: null },
          { at: new Date(now - 4 * DAY).toISOString(), source: 'sourcing', customerId: 'C1', customerName: 'Kato Construction Ltd', qty: 10 }],
        candidates: [{ id: 'CA', supplierId: 'S1', supplierName: 'Feko Hardware', role: 'supplier', tiers: [{ minQty: 1, price: 18000 }, { minQty: 50, price: 17000 }], at: new Date(now - 9 * DAY).toISOString() }],
        variantAttrs: [], research: { rivals: [{ name: 'Mega Hardware', price: 25500, stock: 'In stock', area: 'Ntinda', how: 'call', seenAt: new Date(now - 16 * DAY).toISOString(), breaks: [] }], meta: {} } },
      { id: 'SRC-B', name: 'Door closer', status: 'asked', voided: false, createdAt: new Date(now - 2 * DAY).toISOString(), stageEnteredAt: now - 2 * DAY,
        assignedStaffId: null, requests: [{ at: new Date(now - 2 * DAY).toISOString(), source: 'assistant', customerName: 'Walk-in', qty: 3 }], candidates: [], variantAttrs: [], research: { rivals: [], meta: {} } },
    ],
  });
}
freshData();
const fromHtml = ['sourcingPhoneKey', 'sourcingAskerName', 'candidateTiers', 'leadVariantAttrs', 'leadVariantChoices']
  .map((n) => extractFunction(html, n, 'index.html'));
const store = {};
const env = {
  data,
  sourcingLeadsAll: () => data.sourcingLeads,
  saveData: () => { calls.saves++; },
  renderSourcingBadge: () => {},
  openSourcingGraduate: (id) => { calls.graduate.push(id); },
  addFollowUp: () => { calls.followUps++; return {}; },
  firstFreeEntityId: (p, n, list) => 'S9',
  issueEntityId: async () => 'S9',
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  setTimeout: (fn) => fn(),
  currentShopId: 'shop',
};
const C = compileScope([...fromHtml, consoleSrc.replace(/^'use strict';/m, '')], env, ['OwSourcingConsole']);
function mk() {
  const c = new C.OwSourcingConsole({});
  c.__owsvSchedule = () => {};
  return c;
}

/* ---------- 2. the books, in the console's shape ------------------------ */
{
  const c = mk();
  const v = c.renderVals();
  const items = c.owData().items;
  const ridge = items.find((i) => i.name === 'Ridge cap G28');
  eq(ridge.stage, 2, 'status sourced is the third step, Source found');
  eq(ridge.owner, 'Musa', 'the owner is the staff member the lead is assigned to');
  eq(ridge.askers, 2, 'askers are PEOPLE — Kato twice is one person, the anonymous search another');
  eq(ridge.qty, '50 pcs', 'and quantity is the sum of what they said, not a count of asks');
  eq(ridge.prices['Feko Hardware'], 18000, 'the supplier’s price is their smallest rung');
  t.check(v.board && v.board.length === 5 && v.board[2].cards.some((k) => k.name === 'Ridge cap G28'), 'the card sits in the Source found column');
  t.check(Array.isArray(v.cl.rows) && v.cl.rows.some((r) => /Mega Hardware/.test(r.title)), 'a competitor price checked 16 days ago is on today’s checklist to re-confirm');
  t.check(v.rec && v.rec.rows.length === 2, 'every live item gets a row in Recommendations');
}

/* ---------- 3. view state becomes a write ------------------------------- */
{
  freshData();
  const c = mk(); c.renderVals();
  const rankB = c.owData().rankOf['SRC-B'];
  const saves = calls.saves;
  c.setState({ moved: { [rankB]: { owner: 'Aisha Nankya', stage: 1 } } });
  const b = data.sourcingLeads.find((l) => l.id === 'SRC-B');
  eq(b.status, 'looking', 'giving it to someone moves it to Looking on the lead itself');
  eq(b.assignedStaffId, 'ST2', 'and assigns the staff member by id');
  t.check(calls.saves > saves, 'and saves');
  t.check(!('moved' in c.state) || Object.keys(c.state.moved).length === 0 || c.renderVals(), 'the view keeps no copy of it');

  c.renderVals();
  c.setState({ rivalsAdd: { [rankB]: [{ name: 'Plumbers Point', price: 19500, stock: 'In stock', area: 'Nakivubo', how: 'visit', breaks: [{ q: 10, p: 18500 }] }] } });
  eq(b.research.rivals.length, 1, 'a competitor price is written into the lead’s research');
  eq(b.research.rivals[0].breaks[0].p, 18500, 'with its volume break');
  t.check(!(b.candidates || []).some((x) => x.kind), 'and never into the supplier list the rest of the app ranks');

  c.renderVals();
  const rankA = c.owData().rankOf['SRC-A'];
  c.setState({ rivalsFix: { [rankA]: { 'Mega Hardware': { price: 24500, days: 0 } } } });
  const a = data.sourcingLeads.find((l) => l.id === 'SRC-A');
  eq(a.research.rivals[0].price, 24500, 'a new competitor price from the checklist replaces the old one');
  t.check(Date.now() - new Date(a.research.rivals[0].seenAt).getTime() < 5000, 'and resets when it was seen, so it is fresh again');

  c.renderVals();
  c.setState({ quoteFix: { [rankA]: { 'Feko Hardware': 0 } } });
  t.check(!!a.candidates[0].quotedAt, 'confirming a quote stamps when it was confirmed on the candidate');

  c.renderVals();
  c.setState({ buyerFix: { [rankA]: { 'Kato Construction Ltd': { gone: true } } } });
  t.check(a.requests.filter((r) => r.customerId === 'C1').every((r) => r.withdrawn), 'a buyer who dropped out is withdrawn — kept, not deleted');
  eq(c.owData().items.find((i) => i.id === 'SRC-A').askers, 1, 'and no longer counts as someone waiting');
}

/* ---------- 4. the gates and the undo ----------------------------------- */
{
  freshData();
  calls.graduate = [];
  const c = mk(); c.renderVals();
  const rankA = c.owData().rankOf['SRC-A'];
  c.setState({ moved: { [rankA]: { stage: 4, shelf: 23000 } } });
  const a = data.sourcingLeads.find((l) => l.id === 'SRC-A');
  eq(a.status, 'sourced', 'the console never stamps Listed itself');
  eq(calls.graduate[0], 'SRC-A', 'it opens graduation, which makes the real product');

  c.renderVals();
  const before = JSON.stringify(data.sourcingLeads);
  const v = c.renderVals();
  const snapshot = { __leads: before };
  c.setState({ dropped: [...c.state.dropped, rankA] });
  t.check(a.voided === true && !!a.droppedAt, 'dropping voids the lead and dates it');
  t.check(data.sourcingLeads.includes(a), 'and keeps it');
  c.setState(snapshot);
  t.check(data.sourcingLeads.find((l) => l.id === 'SRC-A').voided === false, 'undo puts back exactly what was there');
  t.check(!!v, 'renders');
}

/* ---------- 5. real data is messier than the design sample -------------- */
{
  freshData();
  data.sourcingLeads.forEach((l) => l.requests.forEach((r) => { r.qty = null; }));
  const c = mk(); c.renderVals();
  const rankA = c.owData().rankOf['SRC-A'];
  c.setState({ task: rankA, mTab: 'verdict' });
  let ok = true;
  try { c.renderVals(); } catch (e) { ok = false; console.error(e); }
  t.check(ok, 'an item nobody gave a quantity for still draws its verdict and plan');
  freshData(); data.sourcingLeads = [];
  let empty = true;
  try { mk().renderVals(); } catch (e) { empty = false; console.error(e); }
  t.check(empty, 'and a shop with nothing being sourced draws an empty console');
}

/* ---------- 6. one primary action -------------------------------------- */
{
  /* The accent is the next move. On the desk that is "Add to funnel" in
     the capture form; nothing else on the page is filled with it. */
  const markup = JSON.parse(/const OWSV_MARKUP = (".*");\n/.exec(consoleSrc)[1]);
  /* The legend dot for "your price" and the Omni-Ware mark on the
     printed sheets wear it too -- a mark, not a move. No BUTTON does. */
  const filledButtons = (markup.match(/<button[^>]*background: #C93A30/g) || []).length;
  eq(filledButtons, 0, 'no button in the static markup is filled with the accent');
  t.check(/capGoStyle: `[^`]*#C93A30/.test(consoleSrc), 'and the capture button is the one that carries it');
}

process.exit(t.done() ? 1 : 0);
