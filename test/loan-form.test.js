#!/usr/bin/env node
'use strict';
/*
 * What the money really costs.
 *
 * The app already knew that "12% flat" is nearer 22%, and that a fee
 * kept back pushes it further still -- migration 0043 was written around
 * exactly that, because flat interest is what SACCOs and microfinance
 * quote here. It said so in twelve-point grey text, four hundred pixels
 * down a five-hundred-pixel modal, under nine boxes of equal weight.
 *
 * AND IT DID NOT SAY IT AT ALL WHEN THE FEE WAS TYPED. ln_fees was
 * missing from the list of fields wired to redraw the preview, so a shop
 * could enter a 12% SACCO loan with a 2% arrangement fee, never touch
 * another field, and never be told the money costs 25.4% a year. The
 * sentence existed and was unreachable by the one action that made it
 * true. Found by typing into the form and watching nothing happen.
 *
 * Run: node test/loan-form.test.js   (or: npm test)
 */
const { read, extractDeclaration, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('loan form');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const scope = compileScope([
  extractDeclaration(src, 'LNF_METHODS', 'index.html'),
  'function methods(){ return LNF_METHODS; }',
], {}, ['methods']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const modal = (/<div class="modal-overlay" id="loanModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];
const verdict = (/function lnfRenderVerdict[\s\S]*?\n\}\n/.exec(code) || [''])[0];

/* ---------- 1. the field that changed nothing ------------------------ */
{
  /* THE BUG. Everything that moves the arithmetic has to redraw, and the
     fee moves it more than anything else on the form. */
  t.check(/\['ln_principal','ln_rate','ln_term','ln_fees','ln_fee_each'\]\.forEach/.test(code),
    'the fee is wired to redraw, which it was not — and so is the per-payment charge');
  t.check(/\.addEventListener\('input', lnfRefresh\)\);/.test(code),
    'and every one of them redraws the whole verdict, not just the old grey line');

  const refresh = (/function lnfRefresh[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/lnfRenderMethods\(\);/.test(refresh) && /lnfRenderVerdict\(\);/.test(refresh)
    && /lnfUpdateCashHint\(\);/.test(refresh),
    'which means the cards, the verdict and the cash line all follow the fee');
}

/* ---------- 2. the verdict is the form ------------------------------- */
{
  t.check(/id="ln_verdict"/.test(modal), 'the true cost has a block of its own');
  /* Above the date and the account, below the terms it is computed from:
     it is the thing being decided, not a footnote under everything. */
  t.check(modal.indexOf('id="ln_verdict"') < modal.indexOf('id="ln_started"'),
    'stated before the paperwork details rather than last');
  t.check(modal.indexOf('id="ln_verdict"') > modal.indexOf('id="ln_fees"'),
    'and after the figures it is worked out from');
  t.check(/\.lnf-verdict-head b\{font-family:'Archivo Black'/.test(src)
    && /font-size:30px/.test((/\.lnf-verdict-head b\{[^}]*\}/.exec(src) || [''])[0]),
    'set at a size that matches what it is worth to somebody deciding whether to sign');

  t.check(/loanTrueCostRate\(l\)/.test(verdict),
    'and it is the TRUE cost — after fees — not the rate on the paperwork');
  t.check(/const overstated = trueCost - \(Number\(l\.ratePct\) \|\| 0\);/.test(verdict),
    'measured against what the agreement claims');
  t.check(/overstated >= 5 \? 'bad' : \(overstated >= 1 \? 'warn' : 'ok'\)/.test(verdict),
    'and coloured by how far apart the two are, so an honest loan is not alarmed over');

  /* The three figures a borrower actually weighs. "You repay" was
     nowhere on the old form -- only a monthly payment and an interest
     total, which have to be multiplied in the head to mean anything. */
  t.check(/You receive/.test(verdict) && /You repay/.test(verdict) && /Every \$\{esc\(freq\.each/.test(verdict),
    'with what you get, what you give back and what it takes each period — named in the loan\'s own rhythm, not always a month');
  /* "You repay" counted principal and interest only, which on a loan
     with a charge on every payment understated it by more than the whole
     interest bill -- in the one cell a borrower reads to decide. */
  t.check(/const repaid = l\.principal \+ interest \+ recurring;/.test(verdict),
    'the repayment being everything handed over: principal, interest AND recurring charges');
  t.check(/loanNetAdvanced\(l\)/.test(verdict),
    'and what you receive being net of anything kept back');
}

/* ---------- 3. why it costs what it costs ---------------------------- */
{
  /* Two different causes, and a borrower can act on the difference: a
     flat rate is the agreement's shape, a fee is a number they might
     negotiate. Collapsing them into one sentence loses that. */
  t.check(/Flat interest and the fee kept back both push it up\./.test(verdict),
    'both causes are named when both apply');
  t.check(/even the part you have paid back/.test(verdict),
    'flat interest is explained in terms of what it does, not by its name');
  t.check(/The fee kept back is part of what the money costs\./.test(verdict),
    'and a fee on an honest rate is named on its own');
  t.check(/Which is what the agreement says\./.test(verdict),
    'while a loan that costs what it claims is told so plainly');
}

/* ---------- 4. the three methods are not peers ----------------------- */
{
  const list = scope.methods();
  eq(list.length, 3, 'every way of charging interest is offered');
  eq(list[0].key, 'reducing_balance', 'the cheaper shape first');
  eq(list[1].key, 'equal_principal', 'then the other balance-based one');
  eq(list[2].key, 'flat', 'and flat last');
  t.check(/Interest on the original sum, all term/.test(list[2].shape),
    'the flat one described by what it does rather than by its name');
  /* The two balance-based methods charge the same interest on the same
     balance and differ ONLY in how the instalment behaves. Naming that
     difference on the card is the whole point -- picking wrong is what
     made the app disagree with a real SACCO's printed sheet. */
  t.check(/same payment monthly/.test(list[0].shape) && /payment falls monthly/.test(list[1].shape),
    'and the two balance-based ones are told apart by what the payment does');

  /* A lender's sheet repeats round figures; matching that rounding is
     what makes the two schedules agree row for row. */
  t.check(/id="ln_round"/.test(modal) && /Nearest 100/.test(modal),
    'the form can be told how the lender rounds');
  t.check(/roundTo: Number\(document\.getElementById\('ln_round'\)\.value\)\|\|0,/.test(code),
    'and the form reads it');
  t.check(/\['ln_round','ln_freq'\]\.forEach\(id=>\s*\r?\n\s*document\.getElementById\(id\)\.addEventListener\('change', lnfRefresh\)\);/.test(code),
    'changing it redraws the arithmetic, like every other figure on the form');
  t.check(/round_to:l\.roundTo\|\|0,/.test(code) && /roundTo:Number\(l\.round_to\)\|\|0,/.test(code),
    'and it survives a round trip to the server, in both directions');

  /* A dropdown showed one at a time, so the difference between them --
     which at the same stated rate is most of the cost of the loan -- was
     invisible at the moment of choosing. */
  t.check(!/<select id="ln_method">/.test(modal), 'the dropdown is gone');
  t.check(/id="ln_methods"/.test(modal) && /<input type="hidden" id="ln_method"/.test(modal),
    'replaced by cards over a hidden field, so the save path is unchanged');
  const rate = (/function lnfRealRateUnder[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const probe = \{\.\.\.l, method\};/.test(rate),
    'each card is priced on the same figures, differing only by method');
  t.check(/loanTrueCostRate\(probe\)/.test(rate),
    'and shows the real annual cost, so the two can be set against each other');
}

/* ---------- 5. what reaches the cash book ---------------------------- */
{
  const hint = (/function lnfUpdateCashHint[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* The NET. The fee never reached the shop, and it is already a cost of
     the month through loanFeesForPeriod -- recording the gross would
     both overstate the cash and charge the fee twice. Said on the form
     now, not only in the code. */
  t.check(/loanNetAdvanced\(l\)/.test(hint),
    'the form says the cash book gets what the lender actually handed over');
  t.check(/after the fee/.test(hint), 'naming the fee as the reason it is less');
  t.check(/Nothing is written to the cash book/.test(hint),
    'and says when nothing will be written at all');

  const save = (/ln_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/editingLoanId == null/.test(save),
    'only a new loan writes a receipt — editing one must not bank the money twice');
}

/* ---------- 6. what the form leads with ------------------------------ */
{
  t.check(/\.lnf input\[type=number\]\.lnf-principal\{font-family:'IBM Plex Mono'/.test(src),
    'the amount borrowed is set apart from the fields that describe it');
  /* Type selectors on both: `.lnf .lnf-principal` would lose to the
     general rule's :not([type]), the same trap the staff and asset forms
     fell into. */
  /* MEASURED, not matched. Every one of these forms asserted its rule
     was present and written after the general one; both were true and
     the field still rendered at 14px, because `input[type=text]` does
     not match an <input> that declares no type. winningDeclaration
     resolves the cascade the way a browser does. */
  eq(winningDeclaration(src, 'ln_lender', 'font-size').value, '18px', 'as is the lender');
  eq(winningDeclaration(src, 'ln_principal', 'font-size').value, '22px',
    'and the amount borrowed actually renders as the subject of the form');
  eq(winningDeclaration(src, 'ln_rate', 'font-size').value, '14px',
    'which only means something because the fields describing the loan do not');
  t.check(/document\.getElementById\('ln_lender'\)\.focus\(\);/.test(code),
    'and the cursor lands on the first thing to type');
}

process.exit(t.done() ? 1 : 0);
