#!/usr/bin/env node
'use strict';
/*
 * Cash In and Cash Out — the till.
 *
 * Every shilling in the business is typed into these two modals. They
 * were a six-field grid in which the amount -- the only reason the form
 * exists -- was a 169x37 box at 14px, byte for byte the same as "Time",
 * a field the app fills in for you.
 *
 * THE FAILURE THIS FILE EXISTS FOR IS A MISPLACED ZERO. In a currency
 * where an ordinary transaction runs to six or seven digits, 2500000 and
 * 250000 are one keystroke apart and, as an unbroken run of digits, look
 * alike at a glance. Nothing in the app caught it: the cash book would
 * report the variance a day later, by which time the money and the
 * memory are both gone. Two things catch it now, and both are tested
 * here:
 *
 *   the grouping   the digits separate as they are typed, so the shape
 *                  of the number is visible while it is being entered.
 *   the words      the figure is written out underneath, the way a
 *                  cheque is and for the same reason -- "two hundred
 *                  fifty thousand" and "two million five hundred
 *                  thousand" cannot be mistaken for one another.
 *
 * Run: node test/till.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the till');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['tillWordsUnder1000', 'tillAmountWords', 'tillGroup'];
const scope = compileScope([
  extractDeclaration(src, 'TILL_ONES', 'index.html'),
  extractDeclaration(src, 'TILL_TENS', 'index.html'),
  extractDeclaration(src, 'TILL_SCALES', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const words = (n) => scope.tillAmountWords(n);
const group = (s) => scope.tillGroup(s);

/* ---------- 1. the pair this whole thing is for --------------------- */
{
  /* One keystroke apart as digits. Not remotely alike as words -- which
     is the entire point, and the reason the words are not decoration. */
  eq(words(250000), 'two hundred fifty thousand shillings', 'two hundred and fifty thousand');
  eq(words(2500000), 'two million five hundred thousand shillings', 'and ten times that');
  t.check(words(250000) !== words(2500000),
    'the two amounts a slipped zero confuses read as completely different sentences');

  eq(group('250000'), '250,000', 'and the digits themselves separate');
  eq(group('2500000'), '2,500,000', 'so the shape of the number is visible while it is typed');
  t.check(group('250000').length !== group('2500000').length,
    'at different widths, which is the difference the eye catches first');
}

/* ---------- 2. the words, across the range a shop actually sees ----- */
{
  eq(words(0), '', 'nothing typed says nothing rather than "zero shillings"');
  eq(words(''), '', 'and neither does an empty box');
  eq(words(900), 'nine hundred shillings', 'hundreds');
  eq(words(1000), 'one thousand shillings', 'a round thousand');
  eq(words(15000), 'fifteen thousand shillings', 'the teens do not become "ten five"');
  eq(words(107500), 'one hundred seven thousand five hundred shillings', 'a gap in the middle');
  eq(words(1000000), 'one million shillings', 'a round million');
  eq(words(1234567), 'one million two hundred thirty four thousand five hundred sixty seven shillings',
    'and every scale at once');
  eq(words(20), 'twenty shillings', 'a bare ten');
  eq(words(21), 'twenty one shillings', 'and a compound one');

  /* Past where writing it out would help, it says nothing rather than
     guessing. A wrong reading here is worse than no reading, because the
     whole value of the line is that it can be trusted at a glance. */
  eq(words(1e12), '', 'past a trillion it declines to write anything');
  t.check(words(999999999999) !== '', 'but everything below that is still written out');

  /* Shillings are not divided in practice, so a fraction is a typo and
     saying so beats writing it out as though it were meant. */
  t.check(/and a fraction — check that/.test(words(1500.5)),
    'a fractional amount is flagged rather than rendered as if it were intended');
  t.check(!/fraction/.test(words(1500)), 'while a whole amount is not');
}

/* ---------- 3. grouping as it is typed ------------------------------ */
{
  const typed = [];
  let v = '';
  for (const ch of '2500000') { v += ch; typed.push(group(v)); }
  eq(typed.join(' '), '2 25 250 2,500 25,000 250,000 2,500,000',
    'the separators regroup on every keystroke rather than after the fact');

  eq(group(''), '', 'an empty box stays empty');
  eq(group('000250000'), '250,000', 'leading zeros are dropped rather than grouped into nonsense');
  eq(group('0'), '0', 'but a lone zero survives, since it is what somebody clearing the box sees');

  /* Pasting is where a hundredfold error would be introduced BY the
     control meant to prevent one: a digits-only filter turns "1500.50"
     into 150050. The point is kept and the rest of the paste dropped. */
  eq(group('1500.50'), '1,500.50', 'a pasted decimal keeps its point');
  eq(group('UGX 45,000/='), '45,000', 'and a pasted label is stripped down to the figure');
  eq(group('1.2.3'), '1.23', 'a second point is a typo, not another decimal');
  eq(group('abc'), '', 'letters alone leave nothing');
}

/* ---------- 4. what the screen is built out of ---------------------- */
{
  const section = (/<div class="modal-overlay" id="cashInModal">[\s\S]*?id="cashOutModal"[\s\S]*?\n<\/div>/.exec(src) || [''])[0];

  /* The amount was the same box and the same 14px as Time. It is now the
     subject of the screen and Time is a footnote. */
  t.check(/class="till-input"/.test(section), 'the amount has a type treatment of its own');
  t.check(/\.till-input\{[\s\S]*?font-size:40px/.test(src), 'set large enough to be the subject of the screen');
  t.check(/\.till-foot-note input\[type=time\]/.test(src),
    'while the time the app already knows is a footnote rather than a field');

  // Both tills, not one. Every improvement has to reach the other side.
  t.check(/id="cb_in_words"/.test(section) && /id="cb_out_words"/.test(section),
    'both tills write the figure out');
  t.check(/id="cb_in_accounts"/.test(section) && /id="cb_out_accounts"/.test(section),
    'both choose an account by tapping one that shows what it holds');
  t.check(/id="cb_in_cats"/.test(section) && /id="cb_out_cats"/.test(section),
    'and both pick a category by tapping rather than typing it out');

  /* The category was a text box with a datalist, which meant retyping
     "Sales Revenue" a dozen times a day. */
  t.check(!/list="dl_income_categories"/.test(section) && !/list="dl_expense_categories"/.test(section),
    'the free-text category box is gone from both');

  /* The customer block is how a debt actually gets collected. It was the
     last field on the form, under Time, behind a parenthetical. */
  t.check(section.indexOf('till-collect') < section.indexOf('cb_in_time'),
    'collecting against a customer comes before the time footnote, not after it');
  t.check(/Settling a customer's debt\?/.test(section),
    'and asks in words somebody would use');
}

/* ---------- 4b. the ordinary fields are styled too ------------------ *
 * The app's input styling is scoped to `.field input`. Rebuilding these
 * modals out of bare <input> elements inside .till blocks dropped every
 * one of them through to the browser's own 2px inset bevel, square
 * corners, one pixel of padding and Arial -- on the screen that had
 * otherwise been given the most attention. Novel controls got designed
 * and the ordinary ones got forgotten, which is exactly what makes a
 * design look unfinished.
 */
{
  // The till does not use .field wrappers, so it has to dress its own.
  t.check(!/class="field"/.test((/<div class="modal-overlay" id="cashInModal">[\s\S]*?id="cashOutModal"[\s\S]*?\n<\/div>/.exec(src) || [''])[0]),
    'the till does not lean on the app\'s .field wrapper');
  const rule = /\.till input\[type=text\]:not\(\.till-input\),[\s\S]*?\}/.exec(src);
  t.check(!!rule, 'so it styles its own text inputs');
  const css = rule ? rule[0] : '';
  t.check(/font-family:inherit/.test(css), 'in the app\'s typeface rather than the browser\'s Arial');
  t.check(/font-size:14px/.test(css), 'at the app\'s size rather than the browser\'s 13.33');
  t.check(/border-radius:9px/.test(css), 'with corners, which a default input has none of');
  t.check(/padding:11px 13px/.test(css), 'and room to type in, against a default one pixel');
  t.check(/width:100%/.test(css) && /box-sizing:border-box/.test(css),
    'filling the block rather than falling back to the browser\'s twenty-character guess');

  /* :not(.till-input) matters: the amount is a text input too, and it
     has a type treatment of its own this must not overwrite. */
  t.check(/:not\(\.till-input\)/.test(css),
    'while leaving the amount its own treatment');
  t.check(/\.till input\[type=text\]:not\(\.till-input\):focus/.test(src),
    'and there is a focus state, so a keyboard can be seen');
  t.check(/\.till-amount:focus-within/.test(src),
    'including on the amount, drawn on the block since the input itself has no border');
}

/* ---------- 5. the account carries what it holds -------------------- */
{
  const fn = (/function tillAccountBalances[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* Read from the cash book's own arithmetic, so the figure on the
     button is the figure on the page behind it. Adding cash up a second
     way here is how a shop ends up with two answers to "what is in the
     drawer". */
  t.check(/cbDayPosition\(currentCbDate\(\)\)/.test(fn),
    'the balance on each button comes from the cash book\'s own position');

  const upd = (/function tillUpdate[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* Testing tillAmountWords in isolation proves the sentence is correct,
     not that anything puts it on the screen. Blanking the single line
     that writes it left every other check in this file green. */
  t.check(/words\.textContent = tillAmountWords\(amount\)/.test(upd),
    'the words are actually written to the screen, not merely computable');
  t.check(/goes from <b>\$\{fmtUGX\(now\)\}<\/b>/.test(upd) && /\$\{fmtUGX\(after\)\}/.test(upd),
    'and the form says what this entry does to it, which it never did before');
  t.check(/holds <b>\$\{fmtUGX\(now\)\}<\/b> right now/.test(upd),
    'saying what the account holds even before an amount is typed');

  /* Paying out more than an account holds is worth saying AT ENTRY --
     the alternative is the cash book reporting the variance tomorrow,
     with nobody able to remember which entry caused it. A WARNING and
     never a block: the drawer figure can itself be wrong, and an app
     that refuses to record what happened just hides the error. */
  t.check(/amount > 0 && after < 0/.test(upd),
    'paying out more than the account holds is flagged');
  t.check(/Record it if that is what happened/.test(upd),
    'as a warning that still lets the entry through, since the drawer figure can be the wrong one');
  /* Pinned on the BALANCE never being consulted while saving, rather
     than on the wording of a refusal. Any guard that could turn the
     warning into a block has to look up what the account holds, and a
     check that only forbade the phrase "overdraw" missed one written
     any other way. */
  const save = (/function saveCashTxn[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(!/tillAccountBalances|cbDayPosition|cbClosingFor/.test(save),
    'and saving never consults the balance at all, so it cannot refuse on one');
}

/* ---------- 6. one keystroke to finish ------------------------------ */
{
  /* A till is used with somebody waiting. Reaching for the mouse to
     finish a number you have just typed is the slowest part of it. */
  /* Pinned as the exact sequence rather than "Enter ... eventually
     saveCashTxn": a lazy span matched happily with a `return;` sitting
     between the two, which is precisely the bug worth catching. */
  t.check(/e\.preventDefault\(\);\s*\n\s*if\(id === `cb_\$\{column\}_category`\)\{ tillRenderCategories\(column\); \}\s*\n\s*saveCashTxn\(column\);/.test(code),
    'Enter saves from any single-line field, with nothing returning early in between');
  t.check(/document\.getElementById\(`cb_\$\{column\}_amount`\)\.focus\(\)/.test(code),
    'and opening a till puts the cursor in the amount, the only field somebody came to fill in');

  // Every reader of the amount goes through the parser, or a grouped
  // "250,000" would reach Number() and come back as 250.
  t.check(!/Number\(document\.getElementById\(prefix\+'amount'\)\.value\)/.test(code),
    'nothing reads the amount box raw');
  t.check((code.match(/tillReadAmount\(/g) || []).length >= 4,
    'every reader goes through the parser that strips the separators');
}

process.exit(t.done() ? 1 : 0);
