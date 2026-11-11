#!/usr/bin/env node
'use strict';
/*
 * The one outbox (src/core/outbox.ts; docs/spec/06-offline-sync-push.md §7):
 * every write goes through it and is sent in order when signal comes back
 * (Q4); a kept write the server refuses is kept with the server's reason
 * until the person fixes or discards it (Q5).
 *
 * Run: node test/sales-core-outbox.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales core outbox');
const { Outbox, memoryStore, isOffline } = require(path.join(ROOT, 'src/core/outbox.ts'));
const { dataError } = require(path.join(ROOT, 'src/core/datasource.ts'));

(async () => {
  let signal = true;
  const sent = [];
  const sender = async (kind, args) => {
    if (!signal) throw dataError('offline', 'No signal');
    if (args && args.bad) throw dataError('refused', 'That price is under what it costs', 'OWCST');
    sent.push(`${kind}:${args.n}`);
    return { ok: args.n };
  };
  const store = memoryStore();
  const box = new Outbox(store, sender, () => 1000);

  const first = await box.run('send', { n: 1 });
  t.check(!first.kept && first.value.ok === 1, 'with signal a write goes at once and its answer comes back');

  let refused = null;
  try { await box.run('place', { n: 2, bad: true }); } catch (e) { refused = e; }
  t.check(refused && refused.code === 'OWCST' && (await box.items()).length === 0, 'with signal a refusal comes straight back, nothing kept');

  signal = false;
  const k1 = await box.run('send', { n: 3 });
  const k2 = await box.run('note', { n: 4, bad: true });
  t.check(k1.kept && k2.kept && (await box.items()).length === 2, 'no signal: kept on this phone');
  t.check((await store.load()).length === 2, 'kept in the store, so it survives the app closing');

  signal = true;
  const k3 = await box.run('send', { n: 5 });
  t.check(k3.kept, 'with signal back, a new write still waits behind the kept ones (sent in order)');

  const told = [], refusals = [];
  // A write may leave the list only after onSent told its id (the list also changes to show "Sending…").
  let seenGone = 1;
  const listed = new Set((await box.items()).map((k) => k.id));
  box.onSent((id, value) => { told.push([id, value]); });
  box.onRefused((id, reason) => { refusals.push([id, reason]); });
  const unsee = box.onChange((l) => {
    const now = new Set(l.map((k) => k.id));
    for (const id of listed) if (!now.has(id) && !told.some((x) => x[0] === id) && !refusals.some((x) => x[0] === id)) seenGone = 0;
  });
  const r = await box.flush();
  unsee();
  t.check(told.length === 2 && told[0][0] === k1.id && told[1][0] === k3.id && told[0][1] && told[0][1].ok === 3, 'onSent: each kept write that went, by its id, with the answer');
  t.check(seenGone >= 1, 'onSent is told before the list changes');
  t.check(refusals.length === 1 && refusals[0][0] === k2.id && /under what it costs/.test(refusals[0][1]), "onRefused: the refused write's id and the server's reason");
  t.check(sent.join(',') === 'send:1,send:3,send:5' && r.sent === 2 && r.refused === 1, `flush sends in order and keeps the refused one (sent ${sent.join(',')})`);
  const left = await box.items();
  t.check(left.length === 1 && left[0].state === 'refused' && /under what it costs/.test(left[0].reason), "the refused write stays, with the server's reason (Q5)");

  await box.retry(left[0].id, { n: 4 });
  await box.flush();
  t.check(sent.includes('note:4') && (await box.items()).length === 0, 'fixed and tried again, it goes');

  signal = false;
  await box.run('send', { n: 6 });
  const before = told.length;
  await box.discard((await box.items())[0].id);
  t.check((await box.items()).length === 0 && told.length === before, 'the person may discard a kept write; it is not told as sent');

  t.check(isOffline(new TypeError('Failed to fetch')) && !isOffline(dataError('refused', 'no')), 'a failed fetch is no signal; a refusal is not');

  // ---- Cross-app round 1, SAL-3 / SAL-4 (docs/audit/cross-app/ROUND-1.md) ----
  const { salesScope } = require(path.join(ROOT, 'src/core/scope.ts'));
  const { STUCK_TRIES } = require(path.join(ROOT, 'src/core/outbox.ts'));
  {
    // The live case: an ask to cancel #0586 (an order the books do not have) failed as "no signal" 8 times
    // and held every later write. Seed it ahead of placeOrder: the order must still reach the server.
    const placed = [];
    const send2 = async (kind, args) => {
      if (kind === 'askCancel') throw dataError('offline', 'No signal');
      placed.push(kind + ':' + (args[0].key || args[0]));
      return { id: 608 };
    };
    const seeded = memoryStore([{ id: 'old-1', kind: 'askCancel', args: [586, 'Entered twice'], at: 1, tries: 7, state: 'kept', reason: '' }]);
    let readsOk = true;
    const box2 = new Outbox(seeded, send2, () => 2000, { scopeOf: salesScope, readsOk: () => readsOk });
    const r2 = await box2.run('placeOrder', [{ key: 'd-mwc1dghy-1', lines: [] }]);
    t.check(!r2.kept && r2.value.id === 608 && placed.join() === 'placeOrder:d-mwc1dghy-1', 'SAL-3: a stuck write on another order never holds up placeOrder (the brief\'s acceptance)');
    const k = await box2.run('askCancel', [586, 'again']);
    t.check(k.kept, 'SAL-3: a write on the same order still waits behind the one kept for it');
    await box2.flush();
    const items2 = await box2.items();
    const bad = items2.find((x) => x.id === 'old-1');
    t.check(bad && bad.state === 'refused' && /Not sent · tried 8 times/.test(bad.reason), `SAL-3: still "no signal" after ${STUCK_TRIES} tries while the books read fine → Not sent, kept to Remove (${bad && bad.reason})`);
    await box2.discard('old-1');
    t.check(!(await box2.items()).some((x) => x.id === 'old-1'), 'SAL-3: Remove takes a Not-sent write off this phone');

    // With no good read the same write is a signal problem: it waits, it is not called Not sent.
    readsOk = false;
    const box3 = new Outbox(memoryStore([{ id: 'o', kind: 'askCancel', args: [586, 'x'], at: 1, tries: 9, state: 'kept', reason: '' }]), send2, () => 1, { scopeOf: salesScope, readsOk: () => readsOk });
    await box3.flush();
    t.check((await box3.items())[0].state === 'kept', 'SAL-3: no good read → still kept, waiting for signal');

    // A refusal of any other kind (a missing order, RLS, a 4xx) is refused at once, never "no signal".
    const box4 = new Outbox(memoryStore([{ id: 'm', kind: 'askCancel', args: [586, 'x'], at: 1, tries: 0, state: 'kept', reason: '' }]),
      async () => { throw dataError('refused', 'This order is no longer in the books.', 'P0002'); }, () => 1, { scopeOf: salesScope });
    await box4.flush();
    const m = (await box4.items())[0];
    t.check(m.state === 'refused' && /no longer in the books/.test(m.reason), 'SAL-3: a missing order is refused on the first try, with the reason');
    t.check(!isOffline(dataError('missing', 'Could not find the function')) && !isOffline(dataError('signed-out', 'x')) && !isOffline(Object.assign(new Error('permission denied'), { code: '42501' })), 'SAL-3: missing, signed-out and RLS are not "no signal"');

    // SAL-4: one draft key, one place — a second placeOrder with the key while one is kept is that one.
    let on = false;
    const box5 = new Outbox(memoryStore(), async (kind, args) => { if (!on) throw dataError('offline', 'No signal'); return { id: 610, key: args[0].key }; }, () => 1, { scopeOf: salesScope });
    const a1 = await box5.run('placeOrder', [{ key: 'd-x-1' }]);
    const a2 = await box5.run('placeOrder', [{ key: 'd-x-1' }]);
    t.check(a1.kept && a2.kept && a1.id === a2.id && (await box5.items()).length === 1, 'SAL-4: the same draft placed twice while kept is kept once');
    on = true;
    const sentIds = [];
    box5.onSent((id) => sentIds.push(id));
    await box5.flush();
    t.check(sentIds.length === 1 && sentIds[0] === a1.id, 'SAL-4: it goes once');

    // The default scope ('*') keeps one line, as before, for an app that does not say what a write is about.
    const box6 = new Outbox(memoryStore([{ id: 'z', kind: 'stopDone', args: ['S1'], at: 1, tries: 0, state: 'kept', reason: '' }]), async () => ({}), () => 1);
    t.check((await box6.run('ask', ['S2'])).kept, 'the default keeps one line: a new write waits behind a kept one');

    // A write left "sending" by a closed app waits again when the app opens.
    const box7 = new Outbox(memoryStore([{ id: 's', kind: 'send', args: [1, 'hi'], at: 1, tries: 1, state: 'sending', reason: '' }]), async () => ({}), () => 1, { scopeOf: salesScope });
    t.check((await box7.items())[0].state === 'kept', 'a write left "sending" when the app closed is kept again');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
