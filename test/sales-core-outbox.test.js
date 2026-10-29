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

  const r = await box.flush();
  t.check(sent.join(',') === 'send:1,send:3,send:5' && r.sent === 2 && r.refused === 1, `flush sends in order and keeps the refused one (sent ${sent.join(',')})`);
  const left = await box.items();
  t.check(left.length === 1 && left[0].state === 'refused' && /under what it costs/.test(left[0].reason), "the refused write stays, with the server's reason (Q5)");

  await box.retry(left[0].id, { n: 4 });
  await box.flush();
  t.check(sent.includes('note:4') && (await box.items()).length === 0, 'fixed and tried again, it goes');

  signal = false;
  await box.run('send', { n: 6 });
  await box.discard((await box.items())[0].id);
  t.check((await box.items()).length === 0, 'the person may discard a kept write');

  t.check(isOffline(new TypeError('Failed to fetch')) && !isOffline(dataError('refused', 'no')), 'a failed fetch is no signal; a refusal is not');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
