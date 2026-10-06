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
  /* Version 2: the popup asks the few figures that decide a loan and
     folds the fee, the charge and the date under one link. The verdict
     follows the last figure that is always on screen, and the folded
     ones still redraw it (section 1). */
  t.check(modal.indexOf('id="ln_verdict"') > modal.indexOf('id="ln_term"'),
    'and after the figures it is worked out from');
  /* The 30px figure in a coloured card was the version-1 form, where the
     verdict competed with nine boxes. In the small popup it is the box
     under the terms, its figures in mono and its ground the tone. */
  t.check(/class="ow-pop-res\$\{tone === 'bad' \? ' ow-pop-res-bad' : tone === 'warn' \? ' ow-pop-res-warn' : ''\}"/.test(verdict),
    'set apart as the result of the form, toned by how far the paperwork is from the truth');

  t.check(/loanTrueCostRate\(l\)/.test(verdict),
    'and it is the TRUE cost — after fees — not the rate on the paperwork');
  t.check(/const overstated = trueCost - \(Number\(l\.ratePct\) \|\| 0\);/.test(verdict),
    'measured against what the agreement claims');
  t.check(/overstated >= 5 \? 'bad' : \(overstated >= 1 \? 'warn' : 'ok'\)/.test(verdict),
    'and coloured by how far apart the two are, so an honest loan is not alarmed over');

  /* What it takes each period, named in the loan's own rhythm, and what
     it costs on top of the sum -- the two lines the version-2 popup
     draws. What reaches you is a third line only when a fee is kept
     back, the one case where it differs from the amount typed. */
  t.check(/\$\{esc\(freq\.each\)\}/.test(verdict) && /in interest and fees/.test(verdict),
    'with what it takes each period — named in the loan\'s own rhythm, not always a month — and what it costs on top');
  /* Interest alone understated a loan with a charge on every payment by
     more than its whole interest bill. */
  t.check(/const costs = interest \+ recurring;/.test(verdict),
    'the cost being everything on top of the sum: interest AND recurring charges');
  t.check(/loanNetAdvanced\(l\)/.test(verdict) && /reaches you, after/.test(verdict),
    'and what you receive being net of anything kept back');
}

/* ---------- 3. why it costs what it costs ---------------------------- */
{
  /* Two different causes, and a borrower can act on the difference: a
     flat rate is the agreement's shape, a fee is a number they might
     negotiate. Collapsing them into one sentence loses that. */
  /* Version 2 says the reason as the tail of the cost line ("71.1% a
     year is what it really costs — ..."), so the words are lower case. */
  t.check(/flat interest and the fee kept back both push it up/.test(verdict),
    'both causes are named when both apply');
  t.check(/even on the part you have paid back/.test(verdict),
    'flat interest is explained in terms of what it does, not by its name');
  t.check(/the fee kept back is part of what the money costs/.test(verdict),
    'and a fee on an honest rate is named on its own');
  t.check(/which is what the agreement says/.test(verdict),
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
  /* Version 2: the popup holds only the fields that decide a loan, so
     they share one size -- 15px, as drawn -- and the figures are set
     in mono. The lender and the amount lead by place, the first row. */
  eq(winningDeclaration(src, 'ln_lender', 'font-size').value, '15px', 'the lender renders at the popup\'s field size');
  eq(winningDeclaration(src, 'ln_principal', 'font-size').value, '15px',
    'and so does the amount borrowed');
  t.check(/IBM Plex Mono/.test(winningDeclaration(src, 'ln_principal', 'font-family').value),
    'in figures that line up');
  eq(winningDeclaration(src, 'ln_rate', 'font-size').value, '15px',
    'and the rate beside them, so no box shouts over another');
  t.check(/document\.getElementById\('ln_lender'\)\.focus\(\);/.test(code),
    'and the cursor lands on the first thing to type');
}

/* ---------- a repayment recorded wrong could not be put right --------
 * The panel listed what had been paid and offered no way to change any
 * of it: a mistyped amount or a wrong date meant the loan reported the
 * wrong balance forever, and the only escape was deleting the loan and
 * its whole history.
 *
 * The trap this guards: loanRepayments() returns a copy SORTED BY DATE,
 * so a row's position in the list says nothing about where it lives in
 * the loan's own array. Editing by display position quietly rewrites a
 * different payment the moment one is entered out of order -- verified
 * live with two repayments stored newest-first.
 */
{
  t.check(/const idx = \(l\.repayments\|\|\[\]\)\.indexOf\(rp\);/.test(src),
    'a row is keyed by its place in the loan\'s own array, not by where it sits on screen');
  t.check(/class="pc-icon-btn ln-pe-edit" data-idx="\$\{idx\}"/.test(src)
    && /class="pc-icon-btn danger ln-pe-del" data-idx="\$\{idx\}"/.test(src),
    'every recorded repayment can be changed or removed');
  t.check(/let lnPayEditIdx = null;/.test(code),
    'the editing cursor lives outside the panel, which is rebuilt on every change');

  const save = (/querySelectorAll\('\.ln-pe-save'\)[\s\S]*?\n  \}\)\);/.exec(code) || [''])[0];
  t.check(/rp\.date = newDate; rp\.amount = newAmount;/.test(save),
    'saving writes the new date and amount');
  t.check(/if\(!\(newAmount > 0\)\)/.test(save) && /if\(!newDate\)/.test(save),
    'and refuses an empty amount or date, the same way recording one does');
  /* The books and the loan must not tell different stories about the
     same money: a repayment carrying a cash-book entry has to carry it
     through the edit. One recorded with "do not touch the cash book" has
     no entry to carry, and stays that way. */
  t.check(/const txn = rp\.cashTxnId==null \? null : \(data\.cashTxns\|\|\[\]\)\.find\(t=> t\.id === rp\.cashTxnId\);/.test(save)
    && /if\(txn\)\{ txn\.amount = newAmount; txn\.date = newDate; \}/.test(save),
    'and the cash book entry follows the repayment it belongs to');

  const del = (/querySelectorAll\('\.ln-pe-del'\)[\s\S]*?\n  \}\)\);/.exec(code) || [''])[0];
  t.check(/if\(!confirm\(/.test(del) && /Its cash book entry goes too/.test(del),
    'removing one asks first, and says the cash entry goes with it');
  t.check(/The loan will show more still owed/.test(del),
    'naming the consequence, since removing a payment increases the debt');
  t.check(/removeCashTxnsByIds\(\[rp\.cashTxnId\]\);/.test(del)
    && /loan\.repayments\.splice\(i, 1\);/.test(del),
    'and takes both the entry and the repayment');
  t.check(/const reopen = \(\)=>\{ saveData\(\); renderLoans\(\); openLoanPerformance\(id\); \};/.test(code),
    'every change is saved and redrawn through one path');

  /* The date and the amount rendered as two adjacent inline boxes with
     nothing between them, so "2026-04-17" and "88,149 UGX" read as one
     string on screen. */
  t.check(/\.dr-single\{display:flex;align-items:center;gap:12px/.test(src),
    'a repayment row spaces its date from its amount');
  t.check(/\.dr-single > span\{flex:1/.test(src),
    'with the date taking the slack so the amount sits at the end');
}

/* ---------- the form reads as a form ----------------------------------
   Two things measured in the browser on the real modal. */
{
  const src = read('index.html');

  /* Every label was a MINIMUM width, so each sized itself to its own text
     and the boxes started at four different places -- 554, 557, 561 and
     585, with "Charge on each payment" pushing its input 31px right of
     the rest. A fixed column puts them all on one line. */
  t.check(/\.lnf-row > label\{[^}]*flex:0 0 156px;\}/.test(src),
    'the label column is a fixed width, so every control starts at the same x');
  t.check(!/\.lnf-row > label\{[^}]*min-width:120px/.test(src),
    'rather than a minimum each label may exceed on its own');

  /* The fee explanation closed the whole terms block, which put it below
     "Figures rounded to" -- 59px and one unrelated row from the box it
     describes, reading as though rounding were what the lender kept
     back. */
  const terms = (/<div class="lnf-terms[^"]*">[\s\S]*?\n          <\/div>/.exec(src) || [''])[0];
  t.check(/Insurance, arrangement and paperwork/.test(terms),
    'the fee explanation is inside the terms block, with the fields');
  const feeAt = terms.indexOf('id="ln_fees"');
  const hintAt = terms.indexOf('Insurance, arrangement and paperwork');
  const roundAt = terms.indexOf('id="ln_round"');
  t.check(feeAt > -1 && hintAt > feeAt && roundAt > hintAt,
    'and sits between the fee it explains and the next field, not after both');
  t.check(/\.lnf-hint-indent\{margin:-3px 0 3px 165px;\}/.test(src),
    'indented to its field\'s box rather than its label, so it reads as belonging above');
  t.check(/@media \(max-width:560px\)\{ \.lnf-hint-indent\{margin-left:0;\} \}/.test(src),
    'and the indent drops away on a phone, where the rows stack anyway');
}

process.exit(t.done() ? 1 : 0);
