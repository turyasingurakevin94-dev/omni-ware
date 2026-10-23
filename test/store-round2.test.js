#!/usr/bin/env node
'use strict';
/*
 * Audit round 2, core workflows (docs/audit/store/ROUND-2.md).
 *
 *   FLOW-01 check-in counts in the unit people see (Ctn or Dozen), keeps the line's own unit,
 *           and reads back through backText -- as Pack and the receipt do.
 *   FLOW-02 every held write waits 10 s; a packed order can be unpacked while it is in the yard.
 *   FLOW-03 the hand-over name follows the typing without a render.
 *   FLOW-04 opening a counter or a sheet puts the cursor in its field.
 *   FLOW-05 one Today card per trip draft.
 *   FLOW-06 "I miscounted" both ways.
 *   FLOW-07 singular and plural from one helper.
 *
 * Run: node test/store-round2.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('audit round 2: core workflows');
const store = read('store.html');

// FLOW-01
t.check(/function lineLevels\(l\)\{/.test(store) && /\[\[pu, per\], \[u, 1\]\]/.test(store), 'a trip line counts in its pack and its own unit');
t.check(/data-act="rclv"/.test(store) && /ACT\.rclv = /.test(store), 'check-in has the unit switch');
t.check(/Math\.round\(Number\(v\) \* rcF\(i\) \* 1e6\) \/ 1e6/.test(store), 'a typed figure is kept in the line\'s own unit (1 Ctn is 20 Dozen)');
t.check(/bought' : 'went for'\} \$\{esc\(backText\(l, b\)\)\}/.test(store), '"Denis bought 1 Ctn" reads through backText');
t.check(!/packUnit\}s of \$\{per\}/.test(store), 'no "1 Ctns of 20" on the pack card');
t.check(/unit: L0\[0\], f: L0\[1\]/.test(store), 'scan to tick asks in the pack and keeps the line\'s own unit');

// FLOW-02
t.check(/ms = Math\.max\(ms \|\| 0, 10000\)/.test(store), 'every held write gives 10 s to undo');
t.check(/function canUnpack\(q\)\{ return !!q && !q\.voided && q\.status === 'preparing' && q\.pickingStatus === 'done' && !q\.carrier; \}/.test(store), 'unpack only while packed and still in the yard');
t.check(/q\.pickingStatus = 'in_progress'; q\.pickingDoneAt = null; q\.bay = null;/.test(store), 'unpack reopens the order and frees its bay, ticks kept');
t.check(/SHEET\.unpack = /.test(store) && /Keep it packed/.test(store) && /No signal · nothing changed · it is still packed/.test(store), 'unpack asks first and says when nothing changed');
t.check(/is back in To pack/.test(store), 'To pack says the order is back and its bay free');

// FLOW-03
const slwho = (store.match(/ACT\['in:slwho'\] = [\s\S]*?\n\s*if \(f && /) || [''])[0];
t.check(/data-live="slfoot"/.test(store) && /Checked together with \$\{name\}/.test(store) && /Slide to hand over to \$\{firstWord\(name\)\}/.test(slwho), 'the slide and the receipt line follow the typing');

// FLOW-04
t.check(/focusSoon\('rc_in_' \+ i, true\)/.test(store) && /focusSoon\('ex_find'\)/.test(store), 'the counter and the extras sheet take the cursor');

// FLOW-05
t.check(/function resumeCard\(j\)\{/.test(store) && /resumeCard\(J\.list\[0\]\)/.test(store) && /Carry on \$\{esc\(firstWord\(tripWho\(R\[0\]\)\)/.test(store), 'one card per trip draft');

// FLOW-06
t.check(/const WHY = \{ short: \['Never came',[\s\S]*?miscount: \['I miscounted'/.test(store) && /k !== 'miscount' && !!WHY\[k\]/.test(store), '"I miscounted" for fewer too, never kept as a reason');

// FLOW-07
t.check(/function nOf\(n, word\)\{/.test(store), 'one helper for a counted word');
t.check(!/\.length\} items\b/.test(store) && !/of \$\{[^}]+\} (lines|stops|items)\b/.test(store), 'no "1 items" or "of 1 lines"');

process.exit(t.done() ? 1 : 0);
