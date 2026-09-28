#!/usr/bin/env node
'use strict';
/*
 * Messages › Today, the To message queue in pages. Ranked dearest first,
 * so page 1 always holds the people whose silence costs most. The page
 * follows the OPEN row, so a row the owner is reading never disappears
 * onto another page under them.
 *
 * Run: node test/messages-queue-pages.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('messages queue pages');
const src = read('index.html');
let pageOf;
try { ({ msgQueuePageOf: pageOf } = compileScope([extractFunction(src, 'msgQueuePageOf', 'index.html')], {}, ['msgQueuePageOf'])); }
catch (e) { /* reported below */ }
t.check(typeof pageOf === 'function', 'msgQueuePageOf compiles');
if (pageOf) {
  const a = pageOf(20, 7, 0, 0);
  t.check(a.page === 0 && a.pages === 3 && a.from === 0 && a.to === 7, 'twenty people at seven a page is three pages, the first holding 1-7');
  const b = pageOf(20, 7, 0, 15);
  t.check(b.page === 2 && b.from === 14 && b.to === 20, 'the page is wherever the open row is (row 16 opens page 3, rows 15-20)');
  const c = pageOf(20, 7, 9, -1);
  t.check(c.page === 2, 'a page past the end comes back to the last one');
  const d = pageOf(0, 7, 0, -1);
  t.check(d.pages === 1 && d.from === 0 && d.to === 0, 'an empty queue is one empty page, not a crash');
}
t.check(/shown\.slice\(pg\.from, pg\.to\)\.map\(r=> queueRow/.test(src), 'the queue draws only the rows on the page');
t.check(/if\(shown\.length <= MSG_QUEUE_PER_CHOICES\[0\]\) return '';/.test(src), 'a queue that fits on one page shows no pager');
t.check(/role="navigation" aria-label="Pages of the queue"/.test(src) && !/<nav class="ow-mq-pg"/.test(src),
  'the pager is a div with a navigation role -- the app styles every <nav> as its side rail');
process.exit(t.done() ? 1 : 0);
