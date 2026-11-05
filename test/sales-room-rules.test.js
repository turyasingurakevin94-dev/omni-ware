#!/usr/bin/env node
'use strict';
/*
 * The small rules behind "real data fits the phone" (the rough-edge hunt, 5 Nov 2026), as pure functions.
 * The screens themselves are walked by test/e2e/sales-room.cjs and test/e2e/flows-fit.cjs.
 *
 *   short()      999,500 is "1M", never "1000k"; a billion is "1.4B", never "1442.9M"
 *   money()      a figure the books do not have is a word, never a real-looking 0
 *   counted()    one rule for plurals; shutFor(): "today", never "0 days"
 *   keyboardUp() the keyboard is up when the screen is a keyboard shorter while a field above the dock is in focus
 *
 * Node 22 runs the TypeScript as it is. Run: node test/sales-room-rules.test.js (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales room rules');
const M = require(path.join(ROOT, 'src/core/money.ts'));
const N = require(path.join(ROOT, 'src/core/names.ts'));
const K = require(path.join(ROOT, 'src/ui/keyboard.ts'));

t.check(M.short(999500) === '1M' && M.short(999499) === '999k' && M.short(1000000) === '1M', 'short: 999,500 is 1M, 999,499 is 999k');
t.check(M.short(1442900000) === '1.4B' && M.short(999999999) === '1B' && M.short(1617220000, 2) === '1.62B', 'short: billions are B');
t.check(M.short(12480000) === '12.5M' && M.short(585000) === '585k' && M.short(9999) === '9,999', 'short: the boards\' figures are unchanged');
t.check(M.money(undefined) === M.NOT_KNOWN && M.money(NaN) === M.NOT_KNOWN && M.money(null) === '0' && M.money(1810000) === '1,810,000', 'money: missing is "not known", null is nothing (0)');
t.check(N.counted(1, 'order') === '1 order' && N.counted(0, 'order') === '0 orders' && N.counted(3, 'bill') === '3 bills', 'counted: one rule for plurals');
t.check(N.plural(1, 'chat') === 'chat' && N.plural(2, 'chat') === 'chats', 'plural: the word alone, when the number is drawn apart');
t.check(N.shutFor(0) === 'today' && N.shutFor(1) === '1 day' && N.shutFor(2) === '2 days', 'a chat shut today says "today", never "0 days"');
t.check(K.keyboardUp({ height: 500, tallest: 800, field: true, inDock: false }), 'keyboard: 300 px shorter with a field in focus is up');
t.check(!K.keyboardUp({ height: 500, tallest: 800, field: false, inDock: false }), 'keyboard: shorter with no field is a resize, not a keyboard');
t.check(!K.keyboardUp({ height: 500, tallest: 800, field: true, inDock: true }), 'keyboard: a field in the dock keeps the dock where it is');
t.check(!K.keyboardUp({ height: 760, tallest: 800, field: true, inDock: false }), 'keyboard: a few pixels shorter (a bar coming and going) is not a keyboard');

process.exit(t.done() ? 1 : 0);
