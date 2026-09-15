#!/usr/bin/env node
'use strict';
/*
 * Quantity advice -- "140 sheets takes about 1,120 nails".
 *
 * 0090's own header says the ratio is the whole value: without it a
 * suggestion can only name a thing, and with it the app can say what a
 * hardware man would say and an advert never does. It is also the one
 * move in the whole strategy that a single supplier cannot answer, which
 * is why it is worth being exact about.
 *
 * Three rules from index.html are followed here rather than copied, and
 * each one is a way of being wrong that reads as right:
 *
 *   - A SENTENCE IS TRUE FROM BOTH ENDS. A pairing written on the other
 *     product about this one still counts.
 *   - THE FIGURE DOES NOT SURVIVE THE TURN. "8 nails per sheet" says
 *     nothing about how many sheets go with a nail, so a reversed pairing
 *     carries no ratio at all.
 *   - NO RATIO, NO FIGURE. An invented quantity is worse than none.
 *
 * Run: node test/client-advice.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('quantity advice');
const fn = read('supabase/functions/client-portal/index.ts');
const page = read('client.html');
const noComments = fn.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. which pairings reach a customer ------------------------ */
{
  const verbs = /const ADVICE_VERBS: Record<string, number> = \{([^}]*)\}/.exec(fn);
  t.check(!!verbs, 'the verbs that reach a customer are named in one place');
  const named = verbs ? (verbs[1].match(/\w+(?=:)/g) || []) : [];
  t.check(JSON.stringify(named.sort()) === JSON.stringify(['needs', 'part', 'with']),
    `needs, part and with (${named.join(', ')})`);

  /* 'after' is self:true in the admin app -- it says when a thing runs
     out, which is the shop's reordering business, not a companion.
     'instead' is a substitute, a different feature for when something
     cannot be had. Offering either as "you also need this" would be the
     portal saying something the shop never said. */
  t.check(!named.includes('after') && !named.includes('instead'),
    'and not after or instead, which are not companions at all');

  // Same five verbs the database allows, so a rule the shop can write is
  // a rule this can read.
  const mig = read('supabase/migrations/0090_product_links.sql');
  const allowed = /verb in \(([^)]*)\)/.exec(mig);
  t.check(!!allowed && named.every(v => allowed[1].includes(`'${v}'`)),
    'every verb it reads is one the table allows');
}

/* ---------- 2. the pairing rules --------------------------------------- */
const detype = (s) => s
  .replace(/:\s*Record<[^>]*>\s*=/g, ' =')
  .replace(/\(([\w$]+)\s*:\s*[\w$\[\]<>,.\s|]+?\)\s*=>/g, '($1) =>')
  .replace(/\((\w+): unknown\)/g, '($1)')
  .replace(/\)\s*:\s*(number \| null|string)\s*\{/g, ') {')
  .replace(/\bconst (\w+): [\w<>,\s\[\]]+ = /g, 'const $1 = ')
  // new Map<string, any[]>() -- an explicit generic on a constructor,
  // which stripTypes leaves alone the same way it leaves new Set<number>()
  .replace(/new (Map|Set)<[^>]*>\(/g, 'new $1(')
  .replace(/!\./g, '.')
  .replace(/\bas\s+\w+/g, '');

/* REVERSE and ADVICE_VERBS are read out of the SOURCE, not written here.
   A copy in this file would mean "needs turns into goes-with" was a fact
   about the test rather than about the function, and the shipped table
   could say anything at all while this stayed green.

   `{ typescript: true }` is not optional: without it stripTypes never
   runs and the annotations evaluate as a syntax error, which is exactly
   how this failed the first time. */
/* extractDeclaration matches `const NAME =` and these carry a type
   annotation in between, so the annotation comes off first. Done here,
   on a copy, rather than by widening _extract -- every other test depends
   on it behaving exactly as it does. */
const untyped = fn.replace(/\b(const|let|var)\s+(\w+)\s*:\s*Record<[^>]*>\s*=/g, '$1 $2 =');

/* THE ADVICE ACTION, AND ONLY IT. Slicing from its opening `if` to the
   end of the file was fine until another action was appended after it --
   the statement reads customer_debt_log.note, entirely legitimately, and
   a "this action never touches note" check that ran to end-of-file
   started failing on somebody else's code. Bounded to its own block. */
const ADVICE = (() => {
  const start = noComments.indexOf('action === "advice"');
  const rest = noComments.slice(start);
  /* The next TOP-LEVEL action, found by its indentation. Searching for
     any "if (action === " cut this block off after 900 characters,
     because the orders block contains a nested one of its own -- and a
     slice that ends early makes every check over it pass for the worst
     possible reason: there was nothing left to look at. */
  const next = rest.indexOf('\n    if (action === ', 10);
  return next > 0 ? rest.slice(0, next) : rest;
})();

/* Measured once, loudly: a slice that ends early makes every check over
   it pass because there was nothing left to look at. */
t.check(ADVICE.length > 2000 && /advice\.slice\(0, ADVICE_MAX\)/.test(ADVICE),
  `the advice block is read whole (${ADVICE.length} chars, ending at its reply)`);

const { pairingsFor, sizeIdx } = compileScope(
  ['sizeIdx', 'pairingsFor'].map(n => detype(extractFunction(fn, n, 'client-portal')))
    .concat(['REVERSE', 'ADVICE_VERBS'].map(n => extractDeclaration(untyped, n, 'client-portal'))),
  {}, ['pairingsFor', 'sizeIdx'], { typescript: true },
);

{
  const L = (fromId, verb, toId, qty, per, extra) =>
    Object.assign({ fromId, verb, toId, qty, per: per || '', active: true,
      fromVariantIdx: null, toVariantIdx: null }, extra || {});

  // The canonical one.
  const forward = pairingsFor([L('SHEET', 'needs', 'NAIL', 8, 'sheet')], 'SHEET', null);
  t.check(forward.length === 1 && forward[0].toId === 'NAIL' && forward[0].qty === 8,
    'a pairing written on this product is found, ratio and all');

  /* Read from the other end. The shop wrote it on the sheets; a basket
     with nails in it should still learn that sheets go with them. */
  const back = pairingsFor([L('SHEET', 'needs', 'NAIL', 8, 'sheet')], 'NAIL', null);
  t.check(back.length === 1 && back[0].toId === 'SHEET',
    'and the same sentence is found from the other end');
  t.check(back[0].qty === null,
    `but WITHOUT the figure -- 8 nails a sheet says nothing about sheets per nail (${back[0].qty})`);
  t.check(back[0].verb === 'with',
    `and needs turns into goes-with, not into needs (${back[0].verb})`);

  // Written at both ends: the owner's own sentence wins, figure and all.
  const both = pairingsFor(
    [L('SHEET', 'needs', 'NAIL', 8, 'sheet'), L('NAIL', 'with', 'SHEET', 3, 'nail')], 'NAIL', null);
  t.check(both.length === 1 && both[0].qty === 3,
    `two sentences saying the same thing are one, and the one written here wins (${JSON.stringify(both.map(x => x.qty))})`);

  // Inactive rules are off.
  t.check(pairingsFor([L('SHEET', 'needs', 'NAIL', 8, 'sheet', { active: false })], 'SHEET', null).length === 0,
    'a rule switched off reaches nobody');
  // Verbs outside the three never appear, from either end.
  t.check(pairingsFor([L('SHEET', 'after', 'NAIL', 8, 'sheet')], 'SHEET', null).length === 0,
    'and neither does a verb that is not a companion');
  t.check(pairingsFor([L('SHEET', 'instead', 'NAIL', 1, 'sheet')], 'NAIL', null).length === 0,
    'in either direction');

  /* Sizes. A rule written for one size of a product applies to that size
     and not to its siblings -- offering the red sheet's rule against a
     blue one is the shop being made to say something it did not. */
  const sized = [L('SHEET', 'needs', 'NAIL', 8, 'sheet', { fromVariantIdx: 1 })];
  t.check(pairingsFor(sized, 'SHEET', 1).length === 1, 'a rule written at a size applies at that size');
  t.check(pairingsFor(sized, 'SHEET', 0).length === 0, 'and not at another');
  t.check(pairingsFor([L('SHEET', 'needs', 'NAIL', 8, 'sheet')], 'SHEET', 1).length === 1,
    'a rule written at no size applies at every size');

  // The most specific rule wins where several could apply.
  const mixed = [L('SHEET', 'needs', 'NAIL', 8, 'sheet'), L('SHEET', 'needs', 'NAIL', 12, 'sheet', { fromVariantIdx: 1 })];
  const at1 = pairingsFor(mixed, 'SHEET', 1);
  t.check(at1.length === 1 && at1[0].qty === 12,
    `the rule written at this size beats the general one (${JSON.stringify(at1.map(x => x.qty))})`);
  const at0 = pairingsFor(mixed, 'SHEET', 0);
  t.check(at0.length === 1 && at0[0].qty === 8, 'and the general one still covers the others');

  /* THE CASE THAT MAKES THE SIZE FILTER LOAD-BEARING, and it took a
     planted defect to find. Replacing the filter with "everything fits"
     passed every check above, because the specificity stage that follows
     drops a wrong-size rule anyway. It does not drop what that rule has
     already done on the way past: a forward rule is added to the
     "already said" set BEFORE the pairings written from the other end are
     read, so a rule about the RED sheet would silently suppress the one
     the shop wrote on the nails about sheets in general -- and the
     customer, looking at a blue sheet, is told nothing at all. */
  const otherEnd = [
    L('SHEET', 'with', 'NAIL', 8, 'sheet', { fromVariantIdx: 0 }),  // about the red sheet only
    L('NAIL', 'with', 'SHEET', null, ''),                            // written on the nails, any sheet
  ];
  const atBlue = pairingsFor(otherEnd, 'SHEET', 1);
  t.check(atBlue.length === 1 && atBlue[0].toId === 'NAIL',
    `a rule at another size does not suppress the one written from the other end (${atBlue.length} found)`);
  t.check(atBlue.length === 1 && atBlue[0].qty === null,
    'and what survives carries no figure, because it came round the turn');
  const atRed = pairingsFor(otherEnd, 'SHEET', 0);
  t.check(atRed.length === 1 && atRed[0].qty === 8,
    `while the size it was written for still gets its own figure (${atRed.length && atRed[0].qty})`);

  t.check(sizeIdx(null) === null && sizeIdx('') === null && sizeIdx('x') === null && sizeIdx(0) === 0,
    'a size of nought is a size, and an empty one is not');
}

/* ---------- 3. the quantity, and when there is none -------------------- */
{
  t.check(/Math\.max\(1, Math\.round\(Number\(l\.qty\) \* fromQty\)\)/.test(noComments),
    'the quantity is the shop\'s ratio times the line');
  t.check(/l\.qty \? Math\.max/.test(noComments),
    'and a rule with no ratio yields null, not a guess');
  t.check(/seen\.qty = want == null \? seen\.qty : \(seen\.qty == null \? want : seen\.qty \+ want\)/.test(noComments),
    'two lines needing the same thing need one quantity between them, not two suggestions');
}

/* ---------- 4. what is left out --------------------------------------- */
{
  t.check(/if \(basketProducts\.has\(l\.toId\)\) continue;/.test(noComments),
    'nothing already on the order is suggested for it');
  t.check(/if \(!product\) continue;/.test(noComments),
    'a pairing naming a product the shop no longer has simply never resolves');
  t.check(/if \(variants\.length && w\.toVariantIdx == null\) continue;/.test(noComments),
    'and a product with sizes where the shop named none is left out -- a suggestion nobody can act on');
  t.check(/const ADVICE_MAX = \d+;/.test(noComments) && /advice\.slice\(0, ADVICE_MAX\)/.test(noComments),
    'the list is capped, because a basket screen is not a catalogue');
}

/* ---------- 5. the shop's private note never crosses ------------------- */
{
  const cols = /const LINK_COLS = "([^"]+)"/.exec(noComments);
  t.check(!!cols, 'the link columns are named in one place');
  t.check(cols && !cols[1].includes('note'),
    `note is not among them -- it is the shop's own note to itself and can say anything (${cols && cols[1]})`);
  t.check(ADVICE.length > 500 && !/\bnote\b/.test(ADVICE),
    `and the action never touches it (${ADVICE.length} chars read)`);

  const block = ADVICE;
  const pushed = /advice\.push\(\{[\s\S]*?\n        \}\);/.exec(block);
  t.check(!!pushed, 'the advice row is built in one place');
  if (pushed) {
    ['cost', 'wholesale', 'retail', 'supplier', 'markup', 'note'].forEach((bad) => {
      t.check(!new RegExp(`\\b${bad}`, 'i').test(pushed[0]), `and carries no ${bad}`);
    });
  }
}

/* ---------- 6. a shop that has written none of this down --------------- */
/*
 * 0090 and 0093 are pasted by hand like everything else. A shop without
 * them knows nothing about what goes with what, which is exactly what it
 * knew yesterday -- so the basket screen it sits on must not fail.
 */
{
  const block = ADVICE;
  t.check(/if \(!withSizes\.error\)/.test(block) && /const plain = await admin\.from\("product_links"\)/.test(block),
    'the size columns are probed by retrying without them, so 0090-without-0093 still works');
  t.check(/if \(!linkRows \|\| !linkRows\.length\) return json\(\{ ok: true, advice: \[\] \}\)/.test(block),
    'and a missing table comes back as no advice rather than as an error');
  t.check(/catch\s*\(err\)[\s\S]{0,200}rows = \[\];/.test(page)
    || /rows = \[\];/.test(page.slice(page.indexOf('async function loadAdvice'))),
    'the page treats a failed request the same way: the basket stays exactly as useful as it was');
}

/* ---------- 7. the sentence -------------------------------------------- */
const SAY = ['esc', 'money', 'plural', 'many', 'adviceLine'];
const say = compileScope(SAY.map(n => extractFunction(page, n, 'client.html')), { MONTHS: [] }, SAY);
const words = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

{
  const nails = { name: 'Roofing nails', variantLabel: '', qty: 1120, unit: 'nail',
    because: [{ name: 'Iron sheets', qty: 140, ratioQty: 8, ratioPer: 'sheet' }] };
  const line = words(say.adviceLine(nails));
  t.check(line === 'Your 140 Iron sheets take about 1,120 Roofing nails, at 8 a sheet. You have none on this order.',
    `the canonical sentence (${line})`);
  t.check(/1,120/.test(line), 'with the figure grouped, because it is a figure a customer checks');

  /* "140 Iron sheets takes about" is what the first version said. A
     plural subject does not take a singular verb, and the shop's product
     names are whatever they are. */
  t.check(/sheets take about/.test(line), 'and the verb agrees with the quantity');
  t.check(/take about/.test(words(say.adviceLine({ ...nails, because: [{ ...nails.because[0], qty: 2 }] }))),
    'plural at two');
  t.check(/takes about/.test(words(say.adviceLine({ ...nails, because: [{ ...nails.because[0], qty: 1 }] }))),
    'singular at one');

  const two = words(say.adviceLine({ ...nails, qty: 1400,
    because: [nails.because[0], { name: 'Ridge caps', qty: 28, ratioQty: 10, ratioPer: 'cap' }] }));
  t.check(/Your other line needs some too/.test(two),
    `a second contributing line is counted, not listed (${two})`);
  t.check(/Your other 2 lines need some too/.test(words(say.adviceLine({ ...nails,
    because: [nails.because[0], nails.because[0], nails.because[0]] }))),
    'and pluralised properly past one');

  /* No ratio, no figure -- and no verb between the two product names
     either. "Your Iron sheets goes with" breaks on a plural name and
     "Ridge caps goes with" breaks on a singular one. */
  const vague = words(say.adviceLine({ name: 'Ridge caps', variantLabel: '', qty: null, unit: 'cap',
    because: [{ name: 'Iron sheets', qty: 140, ratioQty: null, ratioPer: '' }] }));
  t.check(/worth taking with your Iron sheets/.test(vague), `no ratio names no figure (${vague})`);
  t.check(/We have not written down how much/.test(vague), 'and says so plainly');
  t.check(!/\d/.test(vague.replace(/Iron sheets|Ridge caps/g, '')),
    'with no quantity anywhere in it');
  t.check(!/ goes with | go with /.test(vague),
    'and no verb that would have to agree with a product name');

  const bare = words(say.adviceLine({ name: 'Wheelbarrow', variantLabel: '', qty: null, unit: '', because: [] }));
  t.check(/Wheelbarrow — worth taking with what you have on this order/.test(bare),
    `a pairing with no line to point at still reads (${bare})`);
}

/* ---------- 8. the button ---------------------------------------------- */
{
  const block = page.slice(page.indexOf('function renderAdvice'), page.indexOf('/* What this order does'));
  t.check(/a\.qty == null[\s\S]{0,80}'Add ' \+ esc\(a\.name\)/.test(block),
    'with no figure the button offers the thing and no quantity');
  t.check(/money\(a\.qty \* a\.unitPrice\)/.test(block),
    'and with one, what that quantity comes to');
  /* It priced a quantity the shop never wrote down -- "Add caps —
     22,000" was one cap's price standing in for an unknown number -- and
     "Add ones" was what came out of pluralising a unit that did not
     exist. */
  t.check(!/\(a\.qty \|\| 1\) \* a\.unitPrice/.test(block),
    'never a total for a quantity nobody chose');
  t.check(!/many\(a\.unit \|\| 'one'\)/.test(block),
    'and never a pluralised unit that was never there');
  t.check(/a\.availability === 'out' \? '' :/.test(block),
    'nothing out of stock is offered as an add');
  t.check(/We are out of them just now/.test(block),
    'it is named as out instead, because a customer planning a job still wants to know');
}

/* ---------- 9. it never delays the basket ------------------------------ */
{
  const render = page.slice(page.indexOf('function renderBasket('), page.indexOf('function adviceLine'));
  t.check(/loadAdvice\(\);\n\}/.test(render + '\n}') || /loadAdvice\(\);/.test(render),
    'the advice is asked for from renderBasket');
  t.check(render.indexOf('body.innerHTML') < render.indexOf('loadAdvice()'),
    'AFTER the basket is drawn -- a customer looking at their own order does not wait on the shop\'s opinion of it');
  t.check(/if\(shape !== basketShape\(\)\) return;/.test(page),
    'and a reply that arrives after they changed the basket is dropped rather than shown against it');
  t.check(/shape === adviceFor/.test(page),
    'an unchanged basket is not asked about twice');
}

process.exit(t.done() ? 1 : 0);
