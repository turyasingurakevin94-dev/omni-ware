#!/usr/bin/env node
'use strict';
/*
 * Statements on paper.
 *
 * Five documents that could only be read on a screen. The set is what
 * gets taken to a bank, a landlord or an accountant, and none of it left
 * the browser.
 *
 * THE ONE DECISION THAT MATTERS: printing goes through the same context
 * and the same renderers as the screen. A separate print path -- a
 * tidied-up layout with its own arithmetic -- is how a printed balance
 * sheet comes to disagree with the one it was printed from, and the
 * printed one is the copy somebody else relies on.
 *
 * The rest is print mechanics, and each has a way of going wrong that
 * only shows up on paper:
 *
 *   right-aligned figures  the app's generic print rule borders every
 *                          cell and left-aligns it. Correct for a table
 *                          of documents, wrong for a statement, where
 *                          money has to stay in a column to be read down.
 *   a break between docs   but never after the last one, or every print
 *                          ends on a blank sheet.
 *   no colour              a green figure on a black-and-white printer
 *                          comes out mid-grey and reads as less
 *                          important rather than as good news.
 *
 * Run: node test/statements-print.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('statements print');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const printFn = (/function printStatements\(which\)[\s\S]*?\n\}/.exec(code) || [''])[0];
// The print rules live inside the global @media print block; pulled out
// so a selector matching somewhere else in the file cannot pass for one.
const printCss = (/@media print\{([\s\S]*?)\n  \}/.exec(src) || ['', ''])[1];

/* ---------- 1. paper cannot disagree with the screen ----------------- */
{
  t.check(printFn.length > 0, 'there is a print path');
  t.check(/const ctx = statementsContext\(\);/.test(printFn),
    'it works the period out with the same function the screen uses');
  t.check(/statementDocHTML\(d\.key, ctx\)/.test(printFn),
    'and renders each document with the same renderer, so the figures cannot drift apart');
  t.check(!/incomeStatement\(|balanceSheetToday\(|cashFlowStatement\(/.test(printFn),
    'nothing is recomputed on the way to the printer');

  // A backwards range is refused rather than printed as an empty or
  // nonsense document.
  t.check(/if\(!ctx\)\{ toast\(/.test(printFn),
    'a period that runs backwards is refused, not printed blank');
}

/* ---------- 2. one document, or the set ------------------------------ */
{
  t.check(/which === 'all' \? ST_DOCS : ST_DOCS\.filter\(d=> d\.key === which\)/.test(printFn),
    'either the statement on screen or all five');
  t.check(/id="st_print"/.test(src) && /id="st_print_all"/.test(src),
    'with a control for each');
  t.check(/getElementById\('st_print'\)\.addEventListener\('click', \(\)=> printStatements\(stActiveTab\)\)/.test(code),
    'and "Print" prints the one being looked at, not a fixed document');
  t.check(/getElementById\('st_print_all'\)\.addEventListener\('click', \(\)=> printStatements\('all'\)\)/.test(code),
    'while "Print all" takes the set');

  const docs = (/const ST_DOCS = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
  ['overview', 'pl', 'bs', 'cf', 'ratios'].forEach((k) => {
    t.check(new RegExp(`key:'${k}'`).test(docs), `${k} is in the set`);
  });
  t.check(/if\(!docs\.length\) return;/.test(printFn),
    'and an unknown key prints nothing rather than an empty sheet');
}

/* ---------- 3. it says whose it is and what it covers ---------------- */
{
  t.check(/printedShopName\(\)/.test(printFn),
    'the shop is named, since a loose sheet of figures says nothing about whose they are');
  t.check(/\$\{esc\(ctx\.from\)\} to \$\{esc\(ctx\.to\)\}/.test(printFn),
    'the period it covers is on it');
  t.check(/printed \$\{esc\(printedOn\)\}/.test(printFn),
    'and the day it was printed, so an old copy on a desk can be told from a new one');
  t.check(/docs\.length > 1 \? 'Financial statements' : esc\(docs\[0\]\.title\)/.test(printFn),
    'headed by the document when there is one, by the set when there are five');

  /* The footer carries the limitation the whole model rests on. On
     screen it is a panel the reader can go back to; on paper, whatever
     is not printed is not knowable. */
  t.check(/no general ledger behind these/.test(printFn),
    'and it states that there is no ledger behind the figures');
  /* This used to assert that the printed balances were TODAY's whatever
     period was asked for -- which was true, and was the bug: a July set
     carried a balance sheet from today and called them one document.
     The sheet is dated now, so what has to hold is that the paper says
     which date it is as at, and says when that was rebuilt rather than
     taken live. */
  t.check(/The balance sheet is as at \$\{esc\(ctx\.bs\.asOf\)\}/.test(printFn),
    'and names the date the balance sheet is as at');
  t.check(/ctx\.bs\.historic \? ', rebuilt from the dated records rather than taken from today' : ''/.test(printFn),
    'saying so when it was rebuilt rather than taken live');
}

/* ---------- 4. print mechanics --------------------------------------- */
{
  t.check(/@page\{ size:A4; margin:14mm; \}/.test(printCss), 'a page size and a margin are set');

  // The generic rule left-aligns every printed cell. A statement's
  // figures have to stay in a right-hand column.
  t.check(/#printArea \.st-print \.r\{text-align:right;\}/.test(printCss.replace(/\s+/g, ' '))
    || /#printArea \.st-print td\.st-v,[\s\S]*?text-align:right;/.test(printCss),
    'the figures are put back on the right, against the generic printout rule');
  t.check(/#printArea \.st-print th,\s*#printArea \.st-print td\{border:none/.test(printCss),
    'and the boxed grid is taken off, since these are documents not a data table');

  t.check(/#printArea \.st-print-break\{page-break-after:always;\}/.test(printCss),
    'each document starts a new page');
  t.check(/i < docs\.length-1 \? ' st-print-break' : ''/.test(printFn),
    'except the last, which would otherwise end every print on a blank sheet');

  t.check(/#printArea \.st-print tr\{break-inside:avoid;\}/.test(printCss),
    'a row is never split across a page break');

  t.check(/#printArea \.st-print \*\{color:#000 !important;\}/.test(printCss),
    'everything prints black — colour on a mono printer turns meaning into mid-grey');
}

/* ---------- 5. the print area is left as it was found ---------------- */
{
  // #printArea is shared with every other printout in the app. Leaving a
  // statement in it means the next receipt prints with a balance sheet
  // stapled to it.
  t.check(/window\.addEventListener\('afterprint', function cleanup\(\)\{[\s\S]*?printArea'\)\.innerHTML = '';/.test(printFn),
    'the print area is emptied afterwards, so the next receipt does not print a balance sheet with it');
  t.check(/window\.removeEventListener\('afterprint', cleanup\)/.test(printFn),
    'and the listener removes itself rather than stacking one per print');
}

/* ---------- 6. a stale page size from another printout --------------- */
{
  /* Every A5 printout in this app injects a <style> with its own @page
     and removes it on afterprint. afterprint does not always fire --
     cancelling the dialog skips it on several platforms -- so the sheet
     outlives the print it was made for.

     @page does not cascade by specificity; the last one in document
     order wins. A leftover A5 from a receipt therefore overrides the
     statements' A4 and prints a balance sheet onto a receipt-sized page,
     which to whoever pressed the button looks exactly like printing
     being broken. */
  const ids = (/const INJECTED_PRINT_STYLE_IDS = \[([^\]]*)\]/.exec(code) || ['', ''])[1];
  ['receiptPrintStyle', 'clientQuotePrintStyle', 'a5PrintStyle', 'piA5PrintStyle'].forEach((id) => {
    t.check(new RegExp(`'${id}'`).test(ids), `${id} is known to the cleaner`);
  });
  // Every sheet the app injects has to be in that list, or the one left
  // out is the one that breaks the next print.
  const injected = [...code.matchAll(/styleEl\.id = '([A-Za-z0-9]+)'/g)].map((m) => m[1]);
  const unlisted = injected.filter((id) => !new RegExp(`'${id}'`).test(ids));
  t.check(unlisted.length === 0,
    `every injected print sheet is cleared${unlisted.length ? ` (missing: ${unlisted.join(', ')})` : ` (${injected.length} of them)`}`);

  const cleaner = (/function clearInjectedPrintStyles\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(el\) el\.remove\(\);/.test(cleaner),
    'and the cleaner actually takes them out of the document');

  t.check(/clearInjectedPrintStyles\(\);/.test(printFn),
    'the statements clear them before printing');
  // Cleared BEFORE, not only after: the whole point is not depending on
  // an event that may never arrive.
  const clears = (code.match(/clearInjectedPrintStyles\(\);/g) || []).length;
  t.check(clears >= 5,
    `every print path clears first, not just the statements (${clears} call sites)`);
}

process.exit(t.done() ? 1 : 0);
