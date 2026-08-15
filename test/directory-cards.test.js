#!/usr/bin/env node
'use strict';
/*
 * The three directory grids -- suppliers, customers, staff -- and the
 * two things every card in them gets wrong the same way.
 *
 * THE AVATAR. It took character zero of each of the first two words.
 * This shop tells two people of the same name apart by qualifying it:
 * "Feko (Ambrose)" and "Feko (Rebbeca)", "Bahco - Jose", "Reagan -
 * Stuart" and "Ronald - 7th Street". Character zero of the second word
 * is then a bracket or a hyphen -- so 4 of 44 suppliers and 11 of 99
 * customers wore punctuation, and both Fekos came out "F(" while both
 * R-names came out "R-". The one mark whose job is telling two entries
 * apart was identical on exactly the pairs it exists for.
 *
 * Three byte-identical copies of that function, one per grid. Now one.
 *
 * THE FIGURE STRIP. The grid stretches every card in a row to the
 * tallest, but the content stops where it stops, so the figures floated
 * at whatever height their own card's details happened to end --
 * measured across one row at 94px, 115px and 132px from the card top.
 * Three numbers a reader compares across a row, on three different
 * lines. margin-top:auto pins them to the bottom edge, and the slack
 * moves above them where it reads as room.
 *
 * Run: node test/directory-cards.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('directory cards');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const { nameInitials } = compileScope(
  [extractFunction(src, 'nameInitials', 'index.html')], {}, ['nameInitials']);

/* ---------- 1. letters, not characters ------------------------------- */
{
  eq(nameInitials('Kevin Moses'), 'KM', 'two plain words give their two initials');
  eq(nameInitials('Dulisa Hardware'), 'DH', 'as does a trading name');

  /* The four shapes this shop actually uses to qualify a name. Each one
     put punctuation in the avatar before. */
  eq(nameInitials('Feko (Ambrose)'), 'FA', 'a bracketed qualifier gives its letter, not its bracket');
  eq(nameInitials('Bahco - Jose'), 'BJ', 'a hyphen is skipped rather than worn');
  eq(nameInitials('Ivan @Stuart'), 'IS', 'and an at-sign');
  eq(nameInitials('Mariam - 8th Street'), 'M8',
    'a digit counts — it is what distinguishes one 8th Street from another');

  /* The pairs the avatar existed to separate and did not. */
  t.check(nameInitials('Feko (Ambrose)') !== nameInitials('Feko (Rebbeca)'),
    'the two Fekos no longer wear the same mark');
  t.check(nameInitials('Reagan - Stuart') !== nameInitials('Ronald - 7th Street'),
    'nor the two R-names');

  // Nothing in the output but letters and digits, on any of them.
  ['Feko (Ambrose)', 'Bahco - Jose', 'Ivan @Stuart', 'Mariam - 8th Street',
    'Agnes (Mama)', 'Eddy (Bonus HW)', 'Muyanja (Walu)'].forEach((n) => {
    t.check(/^[A-Z0-9]{1,2}$/.test(nameInitials(n)),
      `"${n}" gives clean initials (${nameInitials(n)})`);
  });
}

/* ---------- 2. the edges --------------------------------------------- */
{
  eq(nameInitials('ABC'), 'A', 'one word gives one letter rather than inventing a second');
  eq(nameInitials(''), '?', 'nobody is still somebody');
  eq(nameInitials('   '), '?', 'and so is whitespace');
  eq(nameInitials(null), '?', 'a missing name does not throw');
  eq(nameInitials('- Jose'), 'J', 'a name opening with punctuation falls through to the first real letter');
  eq(nameInitials('(((' ), '?', 'a name with no letters at all admits it rather than printing brackets');
  eq(nameInitials('kato hardware'), 'KH', 'and the result is upper-cased');
}

/* ---------- 3. one function, not three -------------------------------- */
{
  /* Suppliers, customers and staff each had their own copy, identical to
     the byte. Three copies is how one of them gets fixed and two do
     not. */
  ['supplierInitials', 'staffInitials', 'customerInitials'].forEach((old) => {
    t.check(!new RegExp(`function ${old}\\(`).test(src), `${old} is gone`);
    t.check(!new RegExp(`${old}\\(`).test(src), `and nothing still calls it`);
  });
  const calls = (src.match(/nameInitials\(/g) || []).length;
  t.check(calls >= 4, `all three grids go through the one function (${calls} references)`);
  ['sc-avatar">${esc(nameInitials(s.name))}', 'cc-avatar">${esc(nameInitials(c.name))}']
    .forEach((frag) => t.check(src.includes(frag), `the avatar is rendered from it: ${frag.slice(0, 12)}…`));

  /* waInitials stays its own function: it falls back to the last two
     DIGITS of a bare phone number, which is a WhatsApp thread's problem
     and not a directory card's. */
  t.check(/function waInitials\(/.test(src),
    'the WhatsApp one is left alone — it reads phone numbers, which these do not');
}

/* ---------- 4. the figure strip sits on the card's bottom edge -------- */
{
  const rule = (sel) => {
    const m = new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}').exec(src);
    return m ? m[0].trim() : '';
  };
  const stats = rule('.sc-stats');
  t.check(/margin-top:auto/.test(stats),
    `the strip is pushed to the bottom of the card (${stats})`);

  /* Only works because the card is a column flex container. If that ever
     became a plain block, margin-top:auto would compute to zero and the
     figures would silently go back to floating. */
  const card = rule('.supplier-card');
  t.check(/display:flex/.test(card) && /flex-direction:column/.test(card),
    'which requires the card to stay a column flex container');

  /* The customer card has no figure strip -- it ends on the debt row,
     which is the figure people opened the screen for and floated the
     same way: 94px on one card, 115px on the one beside it, 3 of 12
     rows out of step. Pinned identically, or the two grids look like
     they were built by different people. */
  const debt = rule('.cc-debt-row');
  t.check(/margin-top:auto/.test(debt),
    `the customer card's bottom line is pinned too (${debt})`);
  const cCard = rule('.customer-card');
  t.check(/display:flex/.test(cCard) && /flex-direction:column/.test(cCard),
    'and that card is a column flex container as well');
}

/* ---------- 5. a zero is not good news -------------------------------- */
{
  const card = (/function supplierCardHTML[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/sc-stat best \$\{stats\.best \? '' : 'zero'\}/.test(card),
    'a supplier who wins nothing is marked rather than shown a green zero');
  t.check(/sc-stat \$\{stats\.priced \? '' : 'zero'\}/.test(card),
    'and so is one with nothing priced');

  /* .sc-stat.zero b and .sc-stat.best b tie on specificity (0,2,1), so
     the only thing deciding the colour of a zero is which comes LATER.
     The repo has been bitten by this before -- a media query adds no
     specificity either. */
  const bestAt = src.indexOf('.sc-stat.best b{');
  const zeroAt = src.indexOf('.sc-stat.zero b{');
  t.check(bestAt > -1 && zeroAt > -1, 'both rules exist');
  t.check(zeroAt > bestAt,
    'and the zero rule comes after the green one — they tie on specificity, so order is the whole argument');
  t.check(/\.sc-stat\.zero b\{color:var\(--ink-soft\);\}/.test(src),
    'a zero reads as an ordinary count, leaving green for suppliers who actually win something');
}

process.exit(t.done() ? 1 : 0);
