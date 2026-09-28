#!/usr/bin/env node
'use strict';
/*
 * Late entries: an order the shop forgot to enter at the time.
 *
 * B110 Original's order went out on 8 Sep and was typed in on 28 Sep with
 * the quote dated back to the 8th. Treated like a new order it would have
 * been handed to a packer, invoiced on the 28th, its payment put on the
 * 28th in the Cash Book, and announced to the sales group as a job. So:
 *
 *   1. an order dated earlier than the day it was first saved IS a late
 *      entry -- read from what it already stores, nothing new;
 *   2. no packer is ever queued for it;
 *   3. it is invoiced on its own date, which carries the register, the
 *      supplier bills it raises and every age read from it;
 *   4. its payment opens on that date;
 *   5. the sales group is told it is a record, nothing to pack or deliver.
 *
 * Run: node test/late-entry.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('late entry');
const sw = read('shared-worker.js');
const src = read('index.html');

/* ---------- 1. what a late entry is ------------------------------------- */
{
  const fn = extractFunction(sw, 'orderIsBackdated', 'shared-worker.js');
  const isLate = new Function(fn + '\nreturn orderIsBackdated;')();
  const at = (iso) => new Date(iso + 'T10:00:00').toISOString();
  t.check(isLate({ date: '2026-09-08', createdAt: at('2026-09-28') }), 'dated the 8th, entered the 28th: a late entry');
  t.check(!isLate({ date: '2026-09-28', createdAt: at('2026-09-28') }), 'dated the day it was entered: not');
  t.check(!isLate({ date: '2026-09-30', createdAt: at('2026-09-28') }), 'dated ahead (a delivery booked for later): not');
  t.check(!isLate({ date: '2026-09-08' }), 'an old order with no record of when it was entered is never guessed to be one');
  t.check(!isLate(null) && !isLate({ date: 'soon', createdAt: at('2026-09-28') }), 'nothing and a malformed date are not');
  t.check(read('worker-www/shared-worker.js') === sw, 'the Android worker app carries the same rules');
}

/* ---------- 2-5. what follows from it ------------------------------------ */
{
  const queue = extractFunction(sw, 'workerPickQueue', 'shared-worker.js');
  t.check(/&& !orderIsBackdated\(q\)\)/.test(queue), 'no packer is ever queued for a late entry — on the board or the worker phones');

  const inv = extractFunction(src, 'toggleQuoteInvoiced', 'index.html');
  t.check(/const lateOn = q\.invoiced && typeof orderIsBackdated === 'function' && orderIsBackdated\(q\) \? q\.date : null;/.test(inv)
    && /q\.invoicedAt = q\.invoiced \? \(lateOn \|\| todayISO\(\)\) : null;/.test(inv)
    && /q\.invoicedTs = q\.invoiced \? \(lateOn \? new Date\(lateOn \+ 'T12:00:00'\)\.getTime\(\) : Date\.now\(\)\) : null;/.test(inv),
    'it is invoiced on its own date, not the day it was typed in');

  const rp = src.slice(src.indexOf('/* RECEIVE-PAY-JS:BEGIN */'), src.indexOf('/* RECEIVE-PAY-JS:END */'));
  t.check(/defaultDate: focus && typeof orderIsBackdated === 'function' && orderIsBackdated\(focus\) \? \(focus\.invoicedAt \|\| focus\.date\) : null/.test(rp)
    && /date: set\.defaultDate \|\|/.test(rp), 'Receive payment opens on the invoice’s own date, so the Cash Book gets the day it was paid');

  const board = src.slice(src.indexOf('/* ORDER-FLOW-JS:BEGIN */'), src.indexOf('/* ORDER-FLOW-JS:END */'));
  t.check(/'\*RECORD ONLY — already delivered ' \+ o\.backdatedLabel \+ '\. Nothing to pack or deliver\.\*/.test(board),
    'the sales group is told it is a record, nothing to pack or deliver');
  t.check(/var q = ofLiveQ\(o\.id\); if \(!q \|\| o\.backdated\) return;/.test(board), 'autopilot leaves it alone');
  t.check(/if \(oo\.backdated && oo\.stage !== 'completed'\) nx = STAGES\[STAGES\.length - 1\];/.test(board),
    'its next step is Delivered, past packing and the road');
}

process.exit(t.done() ? 1 : 0);
