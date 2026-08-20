#!/usr/bin/env node
'use strict';
/*
 * Adding somebody to the shop.
 *
 * Seven boxes in a flat grid, opening on a disabled one. Three separate
 * commitments were being made through it -- who somebody is, what work
 * they may be handed, and what they cost every month until changed --
 * and it presented them as one undifferentiated list of fields.
 *
 * THE ROLE WAS THE WORST OF IT, and the reason this file exists.
 * staffEligibleForRole is ASYMMETRIC: a worker may be given picking AND
 * delivery, a delivery person only delivery. The form offered "Worker"
 * and "Delivery personnel" as two options in a neutral dropdown, so they
 * read as equal choices. Picking the second quietly narrowed what that
 * person could ever be handed, for ever, and nothing said so -- in a
 * shop where one man does everything, that is a wrong default waiting to
 * happen.
 *
 * SECOND: a pay rate typed here starts a wage being raised on the
 * payroll every month from now until somebody changes it. That
 * machinery exists. The form that started it said nothing about it, so
 * the first anybody saw of a recurring obligation was the screen where
 * it had already been raised.
 *
 * Run: node test/staff-form.test.js   (or: npm test)
 */
const { read, extractDeclaration, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('staff form');
const src = read('index.html');
const worker = read('shared-worker.js');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['SF_ROLES', 'SF_BASES'];
const scope = compileScope([
  extractDeclaration(src, 'SF_ROLES', 'index.html'),
  extractDeclaration(src, 'SF_BASES', 'index.html'),
  'function roles(){ return SF_ROLES; }',
  'function bases(){ return SF_BASES; }',
], {}, ['roles', 'bases']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const modal = (/<div class="modal-overlay" id="staffModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];

/* ---------- 1. the roles are not peers, and say so ------------------ */
{
  /* The asymmetry the whole redesign turns on. Read off the real
     function rather than restated, so this test fails if the rule
     itself ever changes and the copy is left behind. */
  const elig = (/function staffEligibleForRole[\s\S]*?\n\}/.exec(worker) || [''])[0];
  t.check(/role==='delivery'\) return s\.role==='delivery' \|\| s\.role==='worker'/.test(elig),
    'a worker can be given delivery as well as picking');
  t.check(/return s\.role===role;/.test(elig),
    'while a delivery person can only be given delivery');

  const list = scope.roles();
  eq(list.length, 2, 'two roles are offered');
  eq(list[0].key, 'worker', 'the broader one first, because it is the safer default');
  eq(list[1].key, 'delivery', 'and the narrowing one second');

  /* Each says what it UNLOCKS, which is the fact the dropdown hid. */
  t.check(/Picking and delivery/.test(list[0].gives),
    'the worker card says it covers both');
  eq(list[1].gives, 'Delivery', 'and the delivery card says it covers only delivery');
  t.check(/Cannot be given picking/.test(list[1].note),
    'with the narrowing said outright rather than left to be discovered');

  // Not a dropdown any more -- two options that differ in scope are not
  // a list of equals.
  t.check(!/<select id="st_role">/.test(modal),
    'the neutral dropdown that made them look equal is gone');
  t.check(/id="st_roles"/.test(modal) && /<input type="hidden" id="st_role"/.test(modal),
    'replaced by cards over a hidden field, so the save path is unchanged');
  const render = (/function sfRenderRoles[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/r\.key===chosen\?' on':''/.test(render), 'the chosen one is marked');
  t.check(/aria-pressed="\$\{r\.key===chosen\}"/.test(render), 'and says so to a screen reader');
}

/* ---------- 2. narrowing somebody already at work ------------------- */
{
  /* Nothing re-checks an assignment once made, so the orders they hold
     stay theirs -- but they can never be given picking again, and
     finding that out later through an empty candidate list is no way to
     learn it. */
  const warn = (/function sfUpdateRoleWarning[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/chosen !== 'delivery' \|\| s\.role !== 'worker'/.test(warn),
    'the warning is only for an EDIT that narrows a worker, not for every choice');
  t.check(/staffActiveOrders\(s\)\.filter\(a=> a\.capacity === 'worker'\)/.test(warn),
    'counting the picking they hold right now');
  t.check(/those stay theirs, but they cannot be given picking again/.test(warn),
    'and saying what happens to that work as well as what they lose');
  /* Somebody with nothing in hand still loses the capability, so they
     are still told -- just without a count that would read as zero
     orders being at risk. */
  t.check(/They cannot be given picking after this\./.test(warn),
    'with a version for somebody who happens to be holding nothing');
}

/* ---------- 3. what a rate commits the shop to ---------------------- */
{
  const list = scope.bases();
  eq(list[0].key, '', 'not being on the payroll is a first-class choice, not an empty dropdown slot');
  eq(list.length, 4, 'with monthly, weekly and daily beside it');
  eq(list.map((b) => b.key).join(','), ',monthly,weekly,daily',
    'ordered longest period first, so the rate box means less money as the eye travels right');

  const sync = (/function syncStaffPayFields[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* The commitment, said here rather than discovered on the payroll
     screen a month later. */
  t.check(/is raised on the payroll at the end of\s*\n?\s*every month, starting \$\{esc\(month\)\}, until this is changed/.test(sync),
    'a monthly salary says it recurs, from which month, and until when');
  t.check(/nothing is raised for \$\{esc\(month\)\} until\s*\n?\s*somebody counts them/.test(sync),
    'and a daily rate says the month is not costed until the days are entered');
  t.check(/They will not appear on the payroll, and no wage is raised for them\./.test(sync),
    'while nobody on the payroll is told exactly that');

  /* The rate box is taken away rather than greyed: with no basis there
     is no rate to ask for, and a disabled box invites the question of
     how to enable it. */
  t.check(/row\.style\.display = basis \? '' : 'none';/.test(sync),
    'the rate is hidden until there is a basis for it to mean something');
  t.check(/if\(!basis\) input\.value = '';/.test(sync),
    'and cleared, so a rate cannot survive being taken off the payroll');
  /* The label is the only thing on the form that says what the number
     means, and the three readings are twenty-six, four and one times
     each other -- so a wrong one is not a cosmetic slip. */
  t.check(/label\.textContent = basis === 'daily' \? 'Each day'/.test(sync)
    && /basis === 'weekly' \? 'Each week' : 'Each month'/.test(sync),
    'the label says which of the three, since one reading is twenty-six times another');

  /* Still null on the way out, never 0. Somebody half set up has not
     agreed to work for nothing. */
  t.check(/payRate: \(!payBasis \|\| rateRaw === ''\) \? null : Number\(rateRaw\)/.test(code),
    'an empty rate still saves as no rate rather than as a rate of zero');
}

/* ---------- 4. the form opens on something you can type in ---------- */
{
  /* It opened on Staff ID: disabled, generated, first in the grid and
     first in the tab order. The same mistake the cash book made leading
     with yesterday's opening balance. */
  t.check(!/<input id="st_id" disabled>/.test(modal),
    'the generated id is no longer a disabled box at the top of the form');
  t.check(/<input type="hidden" id="st_id">/.test(modal) && /id="st_id_note"/.test(modal),
    'it is a footnote, which still shows it -- it is what the shop will call this person');
  t.check(modal.indexOf('id="st_name"') < modal.indexOf('id="st_id_note"'),
    'and the name comes first, being the only thing somebody came here to type');
  /* BOTH ways in. Adding and editing each open this modal, and a single
     presence check passed while the add path -- the one somebody uses
     most -- had lost its focus call entirely. */
  eq((code.match(/getElementById\('st_name'\)\.focus\(\)/g) || []).length, 2,
    'with the cursor in it, whether the form was opened to add or to edit');

  const show = (/function sfShowIssuedId[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/idIsPending\(el\.value\) \? 'An ID is being issued…'/.test(show),
    'an id still on its way says so rather than showing a placeholder as though it were real');
  t.check(/setTimeout\(show, /.test(show),
    'and is re-read once it lands, since it arrives after a round trip');
}

/* ---------- 5. the cascade ------------------------------------------ */
{
  /* `.sf .sf-name` LOST to `.sf input:not([type])`: :not() lends its
     argument's weight, so an attribute selector inside it outranks a
     second class. The name silently rendered at 14px like everything
     else, and looked deliberate. Caught by measuring the computed size,
     not by reading the rule. */
  /* MEASURED, not matched. Every one of these forms asserted its rule
     was present and written after the general one; both were true and
     the field still rendered at 14px, because `input[type=text]` does
     not match an <input> that declares no type. winningDeclaration
     resolves the cascade the way a browser does. */
  eq(winningDeclaration(src, 'st_name', 'font-size').value, '19px',
    'the name actually renders bigger than the fields that describe the person');
  eq(winningDeclaration(src, 'st_phone', 'font-size').value, '14px',
    'which only means something because those fields do not');
  t.check(/\.sf \.sf-rate input\[type=number\]\{/.test(src),
    'and the rate does the same, for the same reason');
  t.check(src.indexOf('.sf input[type=text],.sf input:not([type])') < src.indexOf('.sf input.sf-name'),
    'with the general rule first and the exceptions after it, so order agrees with weight');
}

process.exit(t.done() ? 1 : 0);
