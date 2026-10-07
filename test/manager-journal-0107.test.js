#!/usr/bin/env node
'use strict';
/*
 * What 0107 adds, and what the app does before and after it lands.
 *
 *  - manager_notes takes four new kinds: snapshot, decision, normal,
 *    offer -- with every kind it already took kept, and one snapshot per
 *    shop per day held by the database itself.
 *  - suppliers take three terms (stop_at_days, credit_days,
 *    delivery_days), whole days or nothing. Probed like every column
 *    after the first set: a supplier row goes up on every save, and an
 *    unknown column would fail the whole upsert.
 *  - The owner sets a cash floor and a payday; until then a month of
 *    rent and salaries stands in for the floor, and wages stay at month
 *    end.
 *  - The new kinds are read and written through one door each; a write
 *    the database refuses names 0107; the daily snapshot is written at
 *    most once, from the owner's session only, and fails silently but
 *    logged.
 *
 * Run: node test/manager-journal-0107.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager journal (0107)');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

/* ---------- 1. the migration ------------------------------------------ */
const mig = read('supabase/migrations/0107_manager_intelligence.sql');
const code = mig.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
{
  t.check(/alter table manager_notes drop constraint if exists manager_notes_kind_check;/.test(code),
    'the old check is dropped by name first');
  const kinds = (/add constraint manager_notes_kind_check\s+check \(kind in \(([^)]*)\)\)/.exec(code) || [])[1] || '';
  eq(kinds.match(/'[a-z]+'/g), ["'meeting'", "'move'", "'review'", "'question'", "'target'", "'play'", "'snapshot'", "'decision'", "'normal'", "'offer'"],
    'every kind the journal already holds is kept, and the four new ones are added');
  t.check(/create unique index if not exists manager_notes_snapshot_day_idx\s+on manager_notes\(shop_id, date\) where kind = 'snapshot';/.test(code),
    'one snapshot per shop per day, held by the database');
  ['stop_at_days', 'credit_days', 'delivery_days'].forEach((c) =>
    t.check(new RegExp(`add column if not exists ${c} integer`).test(code), `suppliers.${c} is a whole number of days`));
  t.check(/stop_at_days is null or stop_at_days >= 0/.test(code) && /credit_days is null or credit_days >= 0/.test(code)
    && /delivery_days is null or delivery_days >= 0/.test(code), 'nullable, and never negative');
  t.check(!/\bnot null\b|\bdefault\b/i.test(code.slice(code.indexOf('alter table public.suppliers'))),
    'no default: a supplier nobody asked about reads "not known", never 0');
  t.check(!/\bdelete\b|\bdrop table\b|\bdrop column\b/i.test(code), 'the executable half deletes nothing');
  t.check(/-- drop index if exists manager_notes_snapshot_day_idx;/.test(mig) && /-- alter table public\.suppliers drop column if exists stop_at_days/.test(mig),
    'and the rollback is written out, commented, in one paste');
  t.check(/never 0/.test(mig) && /not 0/.test(mig), 'it says why blank is not nought');
}

/* ---------- 2. probed, loaded, and saved only where it exists ---------- */
{
  const load = extractFunction(src, 'loadData', 'index.html');
  t.check(/sb\.from\('suppliers'\)\.select\('stop_at_days, credit_days, delivery_days'\)\.limit\(1\)/.test(load),
    'loadData probes for the three terms');
  t.check(/supplierTermsColumns = !\(supplierTermsColR && supplierTermsColR\.error\);/.test(load), 'and remembers the answer');
  t.check(/^let supplierTermsColumns = false;$/m.test(src), 'false until the probe says otherwise');

  // The supplier mapper, run on rows as the database returns them.
  const at = load.indexOf('suppliers: (suppliersR.data||[]).map(');
  let depth = 0, end = -1;
  for (let i = load.indexOf('.map(', at) + 4; i < load.length; i++) {
    if (load[i] === '(') depth++; else if (load[i] === ')' && --depth === 0) { end = i; break; }
  }
  const mapper = new Function('suppliersR', 'return ' + load.slice(at + 'suppliers: '.length, end + 1) + ';');
  const rows = mapper({ data: [{ id: 'S1', name: 'A', stop_at_days: 90, credit_days: 0, delivery_days: null },
    { id: 'S2', name: 'B' }] });
  eq(rows.map((r) => [r.stopAtDays, r.creditDays, r.deliveryDays]), [[90, 0, null], [null, null, null]],
    'loaded as days; 0 stays 0 (cash on delivery) and blank stays null (nobody has said)');

  const FLAGS = ['priceAskedColumn', 'sourcingVariantColumn', 'sourcingImageColumn', 'linkSizeColumn', 'siteStageColumn',
    'cashTransferColumn', 'cashCoversColumns', 'customerTermsColumns', 'waPostKindsColumn', 'cashEntryMetaColumns',
    'cashCloseColumns', 'lotConsignColumn', 'transferColumn', 'stockLogMetaColumns', 'debtLogLinkColumns'];
  const books = () => ({ suppliers: [{ id: 'S1', name: 'A', stopAtDays: 90, creditDays: 0, deliveryDays: null }],
    staff: [], agents: [], customers: [], products: [], prices: [], stock: {}, stockLots: {}, stockLog: [], cashDays: {}, cashTxns: [],
    savedQuotes: [], purchaseInvoices: [], supplierCommissions: [], fixedAssets: [], loans: [], quote: null });
  const sync = (on) => compileScope([fn('dateOrNull'), fn('buildSyncRows')], Object.assign({ sourcingResearchRows: () => [], supplierTermsColumns: on },
    Object.fromEntries(FLAGS.map((f) => [f, true]))), ['buildSyncRows']).buildSyncRows;
  const before = sync(false)(books(), 'shop').suppliers[0];
  t.check(!('stop_at_days' in before) && !('credit_days' in before) && !('delivery_days' in before),
    'before 0107 a supplier row carries exactly the columns it always had — the upsert cannot fail on one');
  const after = sync(true)(books(), 'shop').suppliers[0];
  eq([after.stop_at_days, after.credit_days, after.delivery_days], [90, 0, null], 'after it, all three go up, 0 and null as they are');
}

/* ---------- 3. the supplier form --------------------------------------- */
{
  const modal = (/<div class="modal-overlay" id="supplierModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];
  t.check(/id="s_terms_block" style="display:none;"/.test(modal), 'the terms are hidden until 0107 is known to be there');
  ['s_stop_at', 's_credit_days', 's_delivery_days'].forEach((id) =>
    t.check(new RegExp(`<input id="${id}" type="number" min="0" step="1"[^>]*placeholder="Not known"`).test(modal), `${id}: whole days, blank reads "Not known"`));
  t.check(/id="s_terms_track"/.test(modal) && /id="s_terms_hint"/.test(modal), 'with a line drawing the oldest bill against them');

  const S = compileScope([fn('sfTermValue')], {}, ['sfTermValue']);
  eq(['', '  ', '0', ' 21 ', '12.6', '-3', 'abc', null].map(S.sfTermValue), [null, null, 0, 21, 13, null, null, null],
    'blank is null, 0 is 0, a part day rounds, nonsense is nothing');

  const els = {};
  const el = () => ({ value: '', style: {}, textContent: '', innerHTML: '', classList: { toggle() {} } });
  ['s_terms_block', 's_stop_at', 's_credit_days', 's_delivery_days', 's_terms_track', 's_terms_hint'].forEach((id) => { els[id] = el(); });
  const env = { document: { getElementById: (id) => els[id] || null }, supplierTermsColumns: false, editingSupplierId: 'S1',
    credOpenInvoices: () => [{ supplierId: 'S1', ageDays: 74 }, { supplierId: 'S1', ageDays: 30 }, { supplierId: 'S2', ageDays: 200 }],
    esc: (x) => String(x) };
  const F = compileScope([fn('sfTermValue'), fn('sfReadTerms'), fn('sfShowTerms'), fn('sfTermsDraw'), decl('SF_TERM_FIELDS')], env, ['sfShowTerms', 'sfReadTerms']);
  F.sfShowTerms({ stopAtDays: 90, creditDays: 30, deliveryDays: null });
  eq(els.s_terms_block.style.display, 'none', 'before 0107 the block stays hidden');
  const G = compileScope([fn('sfTermValue'), fn('sfReadTerms'), fn('sfShowTerms'), fn('sfTermsDraw'), decl('SF_TERM_FIELDS')],
    { ...env, supplierTermsColumns: true }, ['sfShowTerms', 'sfReadTerms']);
  G.sfShowTerms({ stopAtDays: 90, creditDays: 30, deliveryDays: null });
  eq([els.s_terms_block.style.display, els.s_stop_at.value, els.s_credit_days.value, els.s_delivery_days.value], ['', 90, 30, ''],
    'after it, the supplier\'s terms fill the boxes, blank where nobody has said');
  t.check(/oldest unpaid bill is 74 days old — 16 days before they stop delivering/.test(els.s_terms_hint.textContent),
    'and the line says how close their oldest bill is: 90 − 74 = 16 days');
  t.check(/class="sp-tt-age" style="left:/.test(els.s_terms_track.innerHTML) && /they stop at <b>90 d<\/b>/.test(els.s_terms_track.innerHTML),
    'drawn as a track: credit, the oldest bill, and the stop');
  eq(G.sfReadTerms(), { stopAtDays: 90, creditDays: 30, deliveryDays: null }, 'read back as whole days or null');

  const save = (/__btn_s_save\.addEventListener[\s\S]*?\n\}\)\);/.exec(src) || [''])[0];
  t.check(/const terms = supplierTermsColumns \? sfReadTerms\(\)/.test(save)
    && /stopAtDays: prior\.stopAtDays \?\? null/.test(save), 'a save reads the boxes where 0107 is there, and carries the old terms forward where not');
  t.check(/stopAtDays: terms\.stopAtDays, creditDays: terms\.creditDays, deliveryDays: terms\.deliveryDays/.test(save),
    'and the record keeps all three — a save no longer strips them');
  const edit = extractFunction(src, 'editSupplier', 'index.html');
  t.check(/sfShowTerms\(s\)/.test(edit) && /s\.stopAtDays != null/.test(edit), 'editing shows them, and opens More details when there are any');
  t.check(/sfShowTerms\(null\)/.test(extractFunction(src, 'resetSupplierForm', 'index.html')), 'a new supplier starts blank');
}

/* ---------- 4. the owner's floor and payday ---------------------------- */
{
  const data = { presetManager: {} };
  const S = compileScope([fn('mgrCashFloor'), fn('mgrPayday'), fn('mgrPaydayLabel'), fn('mgrOrdinal'), decl('MGR_WEEKDAYS')], {
    data, currentPeriod: () => '2026-10',
    committedMonthlyCost: () => ({ total: 4200000, rent: 2500000, wages: 1700000, dailyCount: 1, noRateCount: 0 }),
  }, ['mgrCashFloor', 'mgrPayday', 'mgrPaydayLabel']);
  const stand = S.mgrCashFloor();
  eq([stand.amount, stand.source, stand.parts.rent, stand.parts.wages], [4200000, 'stand-in', 2500000, 1700000],
    'not set: a month of rent and salaries stands in — 2,500,000 + 1,700,000');
  t.check(/stands in/.test(stand.note), 'and says it is a stand-in');
  data.presetManager.cashFloor = 2000000;
  eq([S.mgrCashFloor().amount, S.mgrCashFloor().source], [2000000, 'set'], 'set: the owner\'s figure');
  data.presetManager.cashFloor = 0;
  eq([S.mgrCashFloor().amount, S.mgrCashFloor().source], [0, 'set'], 'a floor of 0 is a real answer, not "not set"');
  data.presetManager.cashFloor = -5;
  eq(S.mgrCashFloor().source, 'stand-in', 'a negative one is not');
  data.presetManager.cashFloor = null;
  eq(S.mgrCashFloor().source, 'stand-in', 'and null is not set');

  eq(S.mgrPayday(), null, 'no payday: null');
  data.presetManager.payday = 'month-end';
  eq(S.mgrPayday(), null, 'an old placeholder is not a payday');
  data.presetManager.payday = { kind: 'monthly', day: 13 };
  eq([S.mgrPayday(), S.mgrPaydayLabel()], [{ kind: 'monthly', day: 13 }, 'the 13th of each month'], 'the 13th of each month');
  data.presetManager.payday = { kind: 'monthly', day: 31 };
  eq(S.mgrPaydayLabel(), 'the last day of each month', 'the 31st is the last day of a shorter month');
  data.presetManager.payday = { kind: 'weekly', day: 5 };
  eq([S.mgrPayday(), S.mgrPaydayLabel()], [{ kind: 'weekly', day: 5 }, 'every Friday'], 'or a weekday');
  data.presetManager.payday = { kind: 'monthly', day: 32 };
  eq(S.mgrPayday(), null, 'a day that is no day is not set');

  const g = extractFunction(src, 'renderManagerGrowth', 'index.html');
  t.check(/id="mgrCashFloorIn"/.test(g) && /id="mgrPaydayIn"/.test(g), 'the settings form asks for both');
  t.check(/What the Manager plans around/.test(g) && /ow-mt-l">Cash floor/.test(g) && /ow-mt-l">Payday/.test(g),
    'and shows them as figures first, with what stands in');
  t.check(/cashFloor: raw === '' \|\| !Number\.isFinite\(num\) \|\| num < 0 \? null : Math\.round\(num\)/.test(g),
    'a blank floor is saved as not set, never as 0');
  t.check(/\{ kind: 'monthly', day: Number\(v\.slice\(2\)\) \}/.test(g) && /\{ kind: 'weekly', day: Number\(v\.slice\(2\)\) \}/.test(g),
    'the payday is saved in the shape mgrPayday reads');
  t.check(/data\.presetManager = \{ \.\.\.\(data\.presetManager \|\| \{\}\),\s*cashFloor/.test(g), 'without disturbing the growth settings beside it');
  t.check(/saveData\(\); renderManager\(\);/.test(g), 'saved, and the Manager redrawn on the new floor');
}

/* ---------- 5. the journal's new kinds, through one door each ---------- */
function fakeSb(answer) {
  const calls = [];
  return { calls, from(table) {
    const q = { table, ops: [] };
    calls.push(q);
    const chain = new Proxy({}, { get(_, k) {
      if (k === 'then') return (res, rej) => Promise.resolve(answer(q)).then(res, rej);
      return (...args) => { q.ops.push([k, ...args]); return chain; };
    } });
    return chain;
  } };
}
const op = (q, name) => q.ops.find((o) => o[0] === name);
const LAYER = ['mgrNotesOfKind', 'mgrNoteInsert', 'mgrSaveDecision', 'mgrSaveNormal', 'mgrSaveOffer', 'mgrOffers', 'mgrSetOfferStatus',
  'mgrMigrationNote', 'mgrSaveSnapshot', 'mgrSnapshots', 'mgrSnapshotAfterLoad', 'mgrBooksCounts', 'mgrDept', 'anShiftDate', 'daysBetweenISO'];
function layer(answer, over) {
  const toasts = [], warns = [], timers = [];
  const sb = fakeSb(answer);
  const env = Object.assign({ sb, currentShopId: 'shop-1', managerNotesTable: true, currentMemberRole: 'owner', todayISO: () => TODAY,
    toast: (m) => toasts.push(m), console: { warn: (...a) => warns.push(a.join(' ')) }, setTimeout: (f) => { timers.push(f); },
    mgrSnapshotBody: () => ({ v: 1, score: 64, depts: {}, checks: {}, levels: {} }),
    data: { savedQuotes: [{ invoiced: true }, { invoiced: true, voided: true }, { invoiced: false }], purchaseInvoices: [{}, { voided: true }],
      stockLog: [{ date: '2026-09-02' }, { date: '2026-08-05' }] } }, over || {});
  const s = compileScope([...LAYER.map(fn), decl('MGR_MIGRATION_0107'), decl('mgrNoteText'), decl('mgrNoteDay'), decl('mgrNoteNum'),
    decl('MGR_DEPTS'), 'let mgrSnapshotKept = null;'], env, LAYER);
  return { s, sb, toasts, warns, timers };
}
(async () => {
  {
    const { s, sb } = layer(() => ({ data: [{ id: 9, date: '2026-10-06', status: 'held', body: { score: 60 }, created_at: 'x' }], error: null }));
    eq(await s.mgrNotesOfKind('play'), { rows: [], error: 'plays are read through managerPlaybook' }, 'a play is never read through here');
    eq((await s.mgrNotesOfKind('review')).error, 'reviews are read through managerRecentReviews', 'nor a review');
    const r = await s.mgrNotesOfKind('snapshot', { since: '2026-09-30', limit: 10 });
    const q = sb.calls[0];
    eq([q.table, op(q, 'eq'), q.ops.filter((o) => o[0] === 'eq').map((o) => o.slice(1)), op(q, 'gte'), op(q, 'limit')],
      ['manager_notes', ['eq', 'shop_id', 'shop-1'], [['shop_id', 'shop-1'], ['kind', 'snapshot']], ['gte', 'date', '2026-09-30'], ['limit', 10]],
      'a kind is read for this shop, since a day, to a limit');
    eq(r, { rows: [{ id: 9, date: '2026-10-06', status: 'held', createdAt: 'x', body: { score: 60 } }], error: null }, 'answering { rows, error }');
    const bad = layer(() => ({ data: null, error: { message: 'relation down' } }));
    eq(await bad.s.mgrNotesOfKind('offer'), { rows: [], error: 'relation down' }, 'a failed read names itself instead of reading as empty');
    const none = layer(() => ({}), { managerNotesTable: false });
    t.check(/not set up/.test((await none.s.mgrNotesOfKind('offer')).error), 'and with no journal at all, says so');
  }
  {
    const { s, sb, toasts } = layer((q) => ({ data: { id: 1, ...op(q, 'insert')[1] }, error: null }));
    eq((await s.mgrSaveOffer({ from: 'friend', name: 'X', amount: 5 })).error, 'Say whether the offer is from a bank or a supplier', 'an offer is from a bank or a supplier');
    eq((await s.mgrSaveOffer({ from: 'bank', name: 'Centenary', amount: 0 })).error, 'An offer needs its amount', 'and has an amount');
    eq(sb.calls.length, 0, 'nothing invalid reaches the journal');
    const ok = await s.mgrSaveOffer({ from: 'bank', name: ' Centenary Bank ', amount: '10000000', rate: 22, termMonths: 12.4,
      expiresOn: '2026-10-18', note: 'second tranche', extra: 'dropped' });
    const ins = op(sb.calls[0], 'insert')[1];
    eq([ins.kind, ins.status, ins.date, ins.shop_id], ['offer', 'open', TODAY, 'shop-1'], 'kept as an open offer, today');
    eq([ins.body.from, ins.body.name, ins.body.amount, ins.body.rate, ins.body.termMonths, ins.body.expiresOn, ins.body.source, 'extra' in ins.body],
      ['bank', 'Centenary Bank', 10000000, 22, 12, '2026-10-18', 'owner', false], 'with only the fields an offer has, cleaned');
    t.check(ok.ok && toasts.length === 0, 'and no complaint');

    const dec = await s.mgrSaveDecision({ title: 'Pay Simba after Kato', levers: [{ id: 'simba', label: 'Simba', choice: 'After Kato pays', dept: 'procurement', from: 'books' }],
      outcome: { lowest: 3200000 } });
    const d = op(sb.calls[1], 'insert')[1];
    eq([d.kind, d.status, d.body.source, d.body.signedOn, d.body.levers[0].from], ['decision', 'signed', 'owner', TODAY, 'books'],
      'a signed choice is its own kind — never a move, so it can never count as the Manager\'s advice');
    t.check(dec.ok && (await s.mgrSaveDecision({})).error === 'A decision needs a title', 'and needs a title');

    await s.mgrSaveNormal({ metric: 'sales', weekday: 6, condition: 'first Saturday of the month', effect: 'busy' });
    const n = op(sb.calls[2], 'insert')[1];
    eq([n.kind, n.status, n.body.metric, n.body.weekday, n.body.source], ['normal', 'active', 'sales', 6, 'owner'], 'a taught normal');
  }
  {
    const refuse = { message: 'new row for relation "manager_notes" violates check constraint "manager_notes_kind_check"', code: '23514' };
    const { s, toasts } = layer(() => ({ data: null, error: refuse }));
    const r = await s.mgrSaveOffer({ from: 'bank', name: 'Centenary', amount: 10000000 });
    eq([r.ok, r.migration], [false, '0107'], 'a database without 0107 refuses the kind');
    t.check(toasts.length === 1 && /paste supabase\/migrations\/0107_manager_intelligence\.sql into the Supabase SQL editor/.test(toasts[0]),
      'and the toast names the one update that fixes it');
    const other = layer(() => ({ data: null, error: { message: 'network down' } }));
    await other.s.mgrSaveNormal({ metric: 'sales' });
    t.check(/network down/.test(other.toasts[0]) && !/0107/.test(other.toasts[0]), 'any other failure says what it was, not a migration');
  }
  {
    let have = [];
    const { s, sb, warns, toasts } = layer((q) => op(q, 'insert') ? { data: { id: 5 }, error: null } : { data: have, error: null });
    const first = await s.mgrSaveSnapshot();
    eq([first.ok, sb.calls.length, op(sb.calls[1], 'insert')[1].kind, op(sb.calls[1], 'insert')[1].status, op(sb.calls[1], 'insert')[1].body.score],
      [true, 2, 'snapshot', 'held', 64], 'the day\'s first load writes one snapshot');
    const again = await s.mgrSaveSnapshot();
    eq([again.already, sb.calls.length], [true, 2], 'and the same session never asks again that day');
    const two = layer((q) => op(q, 'insert') ? { data: null, error: null } : { data: [{ id: 3 }], error: null });
    const r2 = await two.s.mgrSaveSnapshot();
    eq([r2.already, two.sb.calls.length], [true, 1], 'another device already wrote today\'s: nothing is written twice');
    const race = layer((q) => op(q, 'insert') ? { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } } : { data: [], error: null });
    eq((await race.s.mgrSaveSnapshot()).already, true, 'and the unique index settles a race as "already kept"');
    const pre = layer((q) => op(q, 'insert') ? { data: null, error: { message: 'violates check constraint "manager_notes_kind_check"', code: '23514' } } : { data: [], error: null });
    const r3 = await pre.s.mgrSaveSnapshot();
    t.check(!r3.ok && pre.toasts.length === 0 && pre.warns.some((w) => /0107/.test(w)),
      'before 0107 it fails silently — nothing the owner asked for failed — but the log names the fix');
    t.check(toasts.length === 0 && warns.length === 0, 'a snapshot that went in says nothing at all');
    have = [];
  }
  {
    const owner = layer(() => ({ data: [], error: null }));
    owner.s.mgrSnapshotAfterLoad();
    eq(owner.timers.length, 1, 'the owner\'s session schedules the snapshot after the screen is up');
    const staff = layer(() => ({ data: [], error: null }), { currentMemberRole: 'staff' });
    staff.s.mgrSnapshotAfterLoad();
    const admin = layer(() => ({ data: [], error: null }), { currentMemberRole: 'admin' });
    admin.s.mgrSnapshotAfterLoad();
    eq([staff.timers.length, admin.timers.length], [0, 0], 'no other session writes one');
    const boot = extractFunction(src, 'boot', 'index.html');
    t.check(/runStartupReminders\(\);\s*\n\s*mgrSnapshotAfterLoad\(\);/.test(boot), 'hooked once, where the owner\'s books have loaded');
    t.check(!/mgrSaveSnapshot|mgrSnapshotAfterLoad/.test(extractFunction(src, 'renderManager', 'index.html')),
      'and never from a repaint of the Manager');
  }
  {
    const { s, sb } = layer((q) => (q.table === 'wa_messages' ? { count: 264, data: null, error: null } : { count: 24, data: null, error: null }));
    const b = await s.mgrBooksCounts();
    /* 3 quotes: one invoiced and live. 2 bills: one not voided. The log
       starts 5 Aug: 63 days to 7 Oct, 9 whole weeks. */
    eq([b.invoices, b.purchases, b.messages, b.stockWeeks, b.meetings, b.errors], [1, 1, 264, 9, 24, {}], 'on the books, counted');
    const wa = sb.calls.find((q) => q.table === 'wa_messages');
    eq(op(wa, 'select'), ['select', 'id', { count: 'exact', head: true }], 'messages by a count query, not the capped list');
    const mt = sb.calls.find((q) => q.table === 'manager_notes');
    eq(mt.ops.filter((o) => o[0] === 'eq').map((o) => o.slice(1)), [['shop_id', 'shop-1'], ['kind', 'meeting']], 'meetings likewise');
    const down = layer((q) => (q.table === 'wa_messages' ? { error: { message: 'wa down' } } : { count: 24, error: null }));
    const bd = await down.s.mgrBooksCounts();
    eq([bd.messages, bd.errors.messages], [null, 'wa down'], 'a count that fails is null, and its error named — never 0');
  }
  {
    const rows = [
      { id: 1, date: '2026-10-01', status: 'open', body: { from: 'bank', name: 'A', amount: 1, expiresOn: '2026-10-18' } },
      { id: 2, date: '2026-09-01', status: 'open', body: { from: 'bank', name: 'B', amount: 1, expiresOn: '2026-10-01' } },
      { id: 3, date: '2026-10-02', status: 'open', body: { from: 'supplier', name: 'C', amount: 1, expiresOn: '2026-10-09' } },
      { id: 4, date: '2026-10-02', status: 'declined', body: { from: 'bank', name: 'D', amount: 1, expiresOn: '2026-12-01' } },
      { id: 5, date: '2026-10-03', status: 'open', body: { from: 'bank', name: 'E', amount: 1, expiresOn: null } },
    ];
    const { s } = layer(() => ({ data: rows, error: null }));
    const o = await s.mgrOffers();
    eq(o.rows.map((x) => [x.name, x.daysLeft]), [['C', 2], ['A', 11], ['E', null]], 'open offers, soonest to expire first; expired and declined ones drop off');
  }
  process.exit(t.done() ? 1 : 0);
})();
