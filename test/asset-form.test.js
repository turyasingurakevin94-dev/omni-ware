#!/usr/bin/env node
'use strict';
/*
 * Buying something that lasts.
 *
 * Ten fields at one weight, and the money side was AN ACCOUNT WITH NO
 * AMOUNT. Saving wrote the whole cost to the cash book, so a 20,000,000
 * van bought with a 15,000,000 loan and a 5,000,000 deposit recorded
 * 20,000,000 leaving the shop's own bank -- 15,000,000 of it the
 * lender's money, which never passed through the shop at all.
 *
 * Silent, and in the one screen the shop reconciles against a physical
 * count: it would surface days later as a variance of exactly the
 * financed amount, with nothing on the asset to explain it. Found by
 * driving the form and reading what reached data.cashTxns, not by
 * reading the code.
 *
 * The form now asks what actually left, defaults it to the cost less
 * whatever a loan covered, and says what will reach the cash book BEFORE
 * it writes anything.
 *
 * Run: node test/asset-form.test.js   (or: npm test)
 */
const { read, extractDeclaration, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('asset form');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const scope = compileScope([
  extractDeclaration(src, 'FA_METHODS', 'index.html'),
  'function methods(){ return FA_METHODS; }',
], {}, ['methods']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const modal = (/<div class="modal-overlay" id="assetModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];
const save = (/fa_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const pay = (/function faUpdatePayment[\s\S]*?\n\}\n/.exec(code) || [''])[0];

/* ---------- 1. only what actually left reaches the cash book --------- */
{
  /* THE BUG. a.cost put the lender's money through the shop's own bank
     on anything financed. */
  t.check(/addCashPayment\(account, paidNow, 'Equipment purchase'/.test(save),
    'the cash book is written with what was paid, not with what the thing cost');
  t.check(!/addCashPayment\(account, a\.cost,/.test(save),
    'and never with the whole price again');
  t.check(/const paidNow = Number\(document\.getElementById\('fa_paid_now'\)\.value\) \|\| 0;/.test(save),
    'read from a field that exists for the purpose');
  /* Nothing left, nothing written -- rather than a zero-value entry
     sitting in the cash book explaining nothing. */
  t.check(/if\(account && paidNow > 0\)\{/.test(save),
    'and nothing is written at all when nothing left an account');

  t.check(/id="fa_paid_now"/.test(modal), 'the form has somewhere to say how much you paid');
  t.check(/id="fa_loan"/.test(modal) && /id="fa_cash_account"/.test(modal),
    'beside what financed it and where the rest came from');
}

/* ---------- 2. the deposit follows the loan until it is touched ------ */
{
  /* The ordinary case needs no arithmetic from anybody: pick the loan,
     and what is left is what you paid. */
  t.check(/const financed = loan \? Math\.min\(Number\(loan\.principal\)\|\|0, cost\) : 0;/.test(pay),
    'a loan covers at most what the thing cost, never more');
  t.check(/if\(!faPaidTouched\) paidEl\.value = account \? Math\.max\(0, cost - financed\) : '';/.test(pay),
    'and the deposit is the rest of the price, floored at nothing');
  /* Once typed by hand it is left alone. Silently overwriting a figure
     somebody entered is worse than making them retype it. */
  t.check(/faPaidTouched = true;/.test(code),
    'a figure typed by hand stops following the cost and the loan');
  /* Inside openAssetForm, not anywhere in the file: `let faPaidTouched =
     false;` is the declaration, and a bare search for it passed happily
     with the reset deleted — leaving the next asset's deposit frozen at
     whatever the last one was typed to. */
  const openFn = (/function openAssetForm[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/faPaidTouched = false;/.test(openFn),
    'and the flag is cleared when the form is opened again');
}

/* ---------- 3. it says what it will do before it does it ------------- */
{
  t.check(/will be recorded leaving \$\{esc\(label\)\}/.test(pay),
    'the form states what reaches the cash book before anything is saved');
  t.check(/never passed through the shop/.test(pay),
    'and says plainly that the financed part did not');

  /* The three figures shown adding up. A gap is NOT refused -- part of a
     price genuinely can come from somewhere this app does not know about
     -- but it is named, or the register and the cash book disagree by
     exactly that much and nothing says so. */
  t.check(/const gap = Math\.round\(cost - financed - paid\);/.test(pay),
    'what is unaccounted for is worked out');
  /* Pinned as the SHAPE of the branch, not as two strings present
     somewhere in the function. Slipping an early return in front of the
     warn line left both strings sitting there unreachable while the
     check went on passing — the third time today that presence has
     stood in for reachability. */
  t.check(/if\(Math\.abs\(gap\) >= 1\)\{\s*\n\s*out\.className = 'fa-consequence warn';\s*\n\s*out\.innerHTML =/.test(pay),
    'and named rather than refused');
  t.check(/unaccounted for/.test(pay), 'in words that say what is missing');
  t.check(/more than the thing cost/.test(pay),
    'with the other direction worded for what it is, not as a negative shortfall');

  /* Nothing chosen either way is the select's own default -- something
     already owned -- not a gap. Warning there called the whole cost
     missing on a form somebody had only just started. */
  t.check(pay.indexOf('!account && !loan') < pay.indexOf('Math.abs(gap) >= 1'),
    'and choosing nothing at all reads as "already owned" rather than as an error');
  t.check(/recorded as something already owned/.test(pay), 'saying so in words');
}

/* ---------- 4. the two methods can be compared ----------------------- */
{
  const list = scope.methods();
  eq(list.length, 2, 'both depreciation methods are offered');
  eq(list[0].key, 'straight_line', 'the even one first');
  t.check(/The same charge every month/.test(list[0].shape)
    && /Heavier early/.test(list[1].shape), 'each described by its shape');

  /* A dropdown could only ever show one at a time, so the choice --
     which changes profit for years -- was made blind. Each card carries
     what it would charge in the first year. */
  t.check(!/<select id="fa_method">/.test(modal), 'the dropdown that showed one at a time is gone');
  t.check(/id="fa_methods"/.test(modal) && /<input type="hidden" id="fa_method"/.test(modal),
    'replaced by cards over a hidden field, so the save path is unchanged');
  const firstYear = (/function faFirstYearUnder[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/rows\.slice\(0, 12\)\.reduce/.test(firstYear), 'the figure is the first twelve months');
  /* Probed from the RAW inputs. readAssetForm nulls whichever input the
     current method does not use, so reading it back would leave the
     other card permanently blank -- and a comparison with one side
     missing is not a comparison. */
  t.check(/document\.getElementById\('fa_life'\)\.value/.test(firstYear)
    && /document\.getElementById\('fa_rate'\)\.value/.test(firstYear),
    'read from the raw fields, so both cards can show a figure at once');
  t.check(/if\(method === 'reducing_balance' \? !\(rate > 0\) : !\(life > 0\)\) return null;/.test(firstYear),
    'and a method whose own input is empty shows nothing rather than a figure from a guess');
}

/* ---------- 5. editing must not spend the money twice ---------------- */
{
  const open = (/function openAssetForm[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/document\.getElementById\('fa_pay_block'\)\.style\.display = a \? 'none' : '';/.test(open),
    'the whole money block goes when editing something already on the register');
  t.check(/document\.getElementById\('fa_paid_now'\)\.value = '';/.test(open),
    'with the deposit cleared, so nothing is carried into the next asset');
  t.check(/editingAssetId == null/.test(save),
    'and only a new asset writes a payment at all');
}

/* ---------- 6. what the form leads with ------------------------------ */
{
  /* Cost drives every depreciation charge, the value on the balance
     sheet and the entry in the cash book. It was the same 183x37 box at
     14px as Category. */
  /* MEASURED, not matched. This form asserted its rules were present and
     written after the general one; both were true and the name still
     rendered at 14px, because `input[type=text]` does not match an
     <input> that declares no type. winningDeclaration resolves the
     cascade the way a browser does. */
  eq(winningDeclaration(src, 'fa_cost', 'font-size').value, '24px',
    'the cost actually renders as the subject of the form');
  t.check(/IBM Plex Mono/.test(winningDeclaration(src, 'fa_cost', 'font-family').value),
    'in figures that line up');
  eq(winningDeclaration(src, 'fa_name', 'font-size').value, '19px',
    'and the name renders above the fields that describe the thing');
  eq(winningDeclaration(src, 'fa_category', 'font-size').value, '14px',
    'which only means something because those fields do not');

  // The preview was the best thing on the form and sat last, in grey.
  t.check(modal.indexOf('id="fa_preview"') < modal.indexOf('id="fa_notes"'),
    'the schedule preview comes before the notes rather than after everything');
  t.check(/document\.getElementById\('fa_name'\)\.focus\(\);/.test(code),
    'and the cursor lands on the only field somebody came here to type');
}

process.exit(t.done() ? 1 : 0);
