#!/usr/bin/env node
'use strict';
/*
 * One click, one document.
 *
 * A real shop found two purchase invoices — PINV-0143 and PINV-0144 — for
 * the same twenty cartons of hinges, same supplier, same day. Nothing was
 * ordered twice. The Save button was pressed twice, because the first
 * press appeared to do nothing.
 *
 * It appeared to do nothing because it genuinely had not finished. Every
 * save that raises an INV- or PINV- number awaits issueRowId(), which is a
 * round trip to the server so the printed sequence stays dense. Between
 * the click and the record being written there is a window as long as the
 * connection is slow, and the button stayed live for all of it.
 *
 * The restock path is the worst of the three, because it moves stock
 * BEFORE it awaits: the second press did not merely duplicate a bill, it
 * put another twenty cartons on the shelf. A shop reconciling that bill
 * would have found the count wrong too, and no reason for it anywhere.
 *
 * Run: node test/save-once-at-a-time.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('save once at a time');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

let fns = null, err = null;
try { fns = compileScope([extractFunction(src, 'saveOnceAtATime', 'index.html')], {}, ['saveOnceAtATime']); }
catch (e) { err = e; }
t.check(!!fns, `the guard compiles${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { saveOnceAtATime } = fns;
  const btn = { disabled: false };
  // A save shaped like the real one: it mutates, then waits on the server
  // for its document number, then finishes.
  const makeSave = (log) => {
    let release;
    const serverGaveTheNumber = new Promise(r => { release = r; });
    const run = saveOnceAtATime(btn, async () => {
      log.push('stock moved');
      await serverGaveTheNumber;
      log.push('bill written');
    });
    return { run, release };
  };

  /* ---------- 1. the second press during the wait does nothing ------ */
  (async () => {
    {
      const log = [];
      const { run, release } = makeSave(log);
      const first = run();                 // press
      const second = run();                // press again while it waits
      t.check(btn.disabled === true, 'the button greys out while the save is in flight, so the delay is visible');
      release();
      await Promise.all([first, second]);
      t.check(log.filter(x => x === 'stock moved').length === 1,
        `the stock moves once, not twice (${JSON.stringify(log)})`);
      t.check(log.filter(x => x === 'bill written').length === 1,
        'and one bill is written, not two — the PINV-0143/0144 case');
      t.check(btn.disabled === false, 'and the button comes back when it is done');
    }

    /* ---------- 2. it is a guard, not a one-shot ------------------- */
    /*
     * The next genuine restock must still work. A guard that latched
     * would trade a duplicate for a shop that cannot buy stock.
     */
    {
      const log = [];
      const { run, release } = makeSave(log);
      const p = run();
      release();
      await p;
      const second = makeSave(log);
      const p2 = second.run();
      second.release();
      await p2;
      t.check(log.filter(x => x === 'bill written').length === 2,
        'a later save runs normally — the guard closes the window, it does not lock the door');
    }

    /* ---------- 3. a save that throws still reopens ----------------- */
    /*
     * If the id round trip fails, the shop must be able to try again.
     * Without the finally, one network blip would disable saving until
     * the page was reloaded.
     */
    {
      const b2 = { disabled: false };
      const boom = saveOnceAtATime(b2, async () => { throw new Error('network'); });
      await boom().catch(() => {});
      t.check(b2.disabled === false, 'a failed save re-enables its button');
      let ran = false;
      const ok = saveOnceAtATime(b2, async () => { ran = true; });
      await ok();
      t.check(ran, 'and the shop can try again');
    }

    /* ---------- 4. a button already disabled is left that way ------- */
    {
      const b3 = { disabled: true };
      const run = saveOnceAtATime(b3, async () => {});
      await run();
      t.check(b3.disabled === true,
        'a button disabled for its own reasons is restored to disabled, not silently enabled');
    }

    /* ---------- 5. every save that awaits a number is wrapped ------- */
    /*
     * The three that issue paperwork numbers from a click. Listed by name
     * rather than counted, so adding a fourth unguarded one is a failure
     * here and not a silent regression in the shop's books.
     */
    ['q_save_btn', 's_save', 'inv_purchase_save_btn'].forEach(id => {
      const re = new RegExp(`__btn_${id}\\.addEventListener\\('click', saveOnceAtATime\\(__btn_${id}, async`);
      t.check(re.test(code), `${id} is guarded`);
    });
    t.check(!/getElementById\('inv_purchase_save_btn'\)\.addEventListener\('click', async/.test(code),
      'and the unguarded form of the restock save is gone');

    // The restock handler is the one that moves stock before it awaits,
    // which is why a second press cost twenty cartons rather than only a
    // duplicate bill. Stated here so the ordering is not "tidied" later.
    const restock = code.slice(code.indexOf('__btn_inv_purchase_save_btn.addEventListener'));
    const body = restock.slice(0, restock.indexOf('}));'));
    t.check(body.indexOf('applyStockDelta') < body.indexOf('await generatePurchaseInvoiceForRestock'),
      'the restock still moves stock before awaiting its bill number — the guard is what makes that safe');

    process.exit(t.done() ? 1 : 0);
  })();
} else {
  process.exit(t.done() ? 1 : 0);
}
