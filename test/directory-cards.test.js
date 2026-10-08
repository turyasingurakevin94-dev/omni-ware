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
  /* Both directory grids are registers now -- Customers first, then
     Suppliers -- and a 13px table row has no width for a 38px square,
     so both avatars went with their cards. The point of this section is
     unchanged and is not about any one grid: ONE initials function,
     never a private copy per screen. The count above still has to clear
     four, and every avatar left in the app is lettered by it. */
  ['<span class="sx-av">${esc(nameInitials(s.name))}']
    .forEach((frag) => t.check(src.includes(frag), `the avatar is rendered from it: ${frag.slice(0, 12)}…`));
  t.check(!/cc-avatar/.test(src),
    'and the customer card\'s avatar is gone with the card, not left styling nothing');
  /* Scoped to the register, not to the file: the agent roster still
     wears .supplier-card and .sc-avatar, and those are its own. What
     went is the SUPPLIERS screen's avatar -- 44 oxide marks on a screen
     allowed one accent, lettering two characters that told a reader
     nothing the name beside them did not. */
  t.check(!/sc-avatar/.test(extractFunction(src, 'supplierRegisterRowHTML', 'index.html')),
    'and the supplier register draws no avatar: 44 oxide marks on a screen allowed one accent');

  /* This used to pin that waInitials stayed its OWN function, because
     it fell back to the last two DIGITS of a bare phone number -- a
     WhatsApp thread's problem, not a directory card's. The pin has
     nothing left to protect: the WhatsApp screen stopped drawing
     avatars altogether when its imitation of a chat app became a work
     queue, and waInitials went with the hue it was drawn in. What this
     section still guards is the thing that mattered -- one initials
     function for the three directory grids, never three copies. */
  t.check(!/function waInitials\(/.test(src),
    'and the WhatsApp copy is gone too, with the avatars it lettered');
}

/* ---------- 3b. the SHAPE, not just the three old names ---------------
 *
 * Banning supplierInitials, staffInitials and customerInitials BY NAME
 * left the door open, and something walked through it: agentCardHTML
 * carried the fault inline, with no function name to ban --
 *
 *     const initials = (a.name||'?').trim().split(/\s+/)
 *       .slice(0,2).map(w=>w[0]).join('').toUpperCase();
 *
 * -- so "Reagan - Stuart" was lettered "R-", the exact bug section 3
 * exists to prevent, sitting four hundred lines below the function that
 * fixes it. Three more copies were doing it in the agent app and on the
 * public catalogue, where the mark is the first thing a customer sees.
 *
 * So the pin is on the MISTAKE rather than on the names anybody happened
 * to give it: nothing in any shipped file may take character zero of a
 * word and call it an initial. Every file is checked, because agent.html
 * and catalogue.html share no script with index.html and each needs its
 * own copy of nameInitials -- and a copy is only safe while there is one
 * of it.
 */
{
  const FILES = ['index.html', 'agent.html', 'catalogue.html', 'worker.html'];
  /* The shape, loosely: split a name on whitespace and take [0] of each
     word. Written to match the four that shipped and anything close
     enough to be the same mistake, not to be a general JS parser. */
  const CHAR_ZERO = /split\(\/\\s\+\/\)[\s\S]{0,40}?map\(\s*w\s*=>\s*w\[0\]\s*\)/g;
  FILES.forEach((f) => {
    const text = read(f);
    const hits = text.match(CHAR_ZERO) || [];
    t.check(hits.length === 0,
      `${f} computes no initials from character zero${hits.length ? ' — ' + hits[0].slice(0, 60) : ''}`);
  });

  /* And each app that letters an avatar has exactly ONE implementation
     to fix when this is wrong again. */
  ['index.html', 'agent.html', 'catalogue.html'].forEach((f) => {
    const defs = (read(f).match(/function nameInitials\(/g) || []).length;
    t.check(defs === 1, `${f} defines nameInitials exactly once (got ${defs})`);
  });

  /* The two helpers in the agent app are wrappers, not second opinions:
     an agent's initials and a client's have to be the same letters for
     the same name. */
  const agent = read('agent.html');
  t.check(/function clientInitials\(name\)\{ return nameInitials\(name\); \}/.test(agent),
    "the agent app's client initials go through it");
  t.check(/return nameInitials\(myAgent && myAgent\.name\);/.test(agent),
    "and so do the agent's own");
  /* The admin app's agent screen, which is where this was found. It was
     agentCardHTML with the copy inline; the screen has since been
     rebuilt as a console register and brought a NEW private copy with
     it, under a new name -- agentInitials(name) -- which is precisely
     why the check above is on the shape rather than on any call site.
     There is no wrapper left: the one place that letters an agent goes
     straight to the shared function. */
  t.check(!/function agentInitials\(/.test(src),
    'the admin app keeps no private initials function of its own');
  /* The queue's avatar is the canvas's now -- .agv-qa, tinted by the
     row's key -- and still lettered by the shared function. */
  t.check(/<span class="agv-qa[^"]*"[^>]*>\$\{esc\(nameInitials\(r\.who\)\)\}<\/span>/.test(src),
    'and its agent avatar is lettered by the shared one');
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

  /* THE CUSTOMER GRID SOLVED THIS BY NOT BEING A GRID.

     Its balance floated the same way -- 94px from the card top on one,
     115px on the one beside it, 3 of 12 rows out of step -- and
     margin-top:auto pinned it, which fixed the symptom: the figures
     lined up ACROSS a row and still could not be read DOWN one, because
     a grid of cards has no columns. Customers is a table now, whose
     tracks are declared once on the container and whose rows span them
     with subgrid, so two figures cannot land on two lines. Alignment
     stopped being something a rule has to defend, which is why the pin
     is on the tracks instead.

     The suppliers directory is still a grid, so the rule above still
     matters and is still checked. */
  t.check(!/\.customer-card\{/.test(src) && !/\.cc-debt-row\{/.test(src),
    'the customer card and its pinned bottom line are gone from the file, not merely unused');
  t.check(/\.ow-tbl\.cu-tbl\{--ow-tbl-cols:/.test(src),
    'and the register declares its tracks once on the container');
  t.check(/\.ow-tbl-n\{[\s\S]{0,300}?justify-self:end;text-align:right;white-space:nowrap/.test(src),
    'with the figure cell that never gives way, so no money column can drift or be cut');
}

/* ---------- 5. a zero is not good news -------------------------------- */
{
  /* This lived on .sc-stat: the supplier card showed "27 BEST PRICE" in
     verdigris, and a supplier who won nothing showed a green 0 -- a
     zero painted as good news. .sc-stat.zero fixed it by dropping such
     a figure back to ordinary ink, and the whole argument was which of
     two tying rules came LATER in the file.

     The card is a register row now and the figure is the column the
     screen is RANKED on, so the same question is asked of the same
     figure in its new home: green where they are winning lines, plain
     ink where they win none, and a dash where they price nothing at all
     and the app cannot say they win none. */
  const row = extractFunction(src, 'supplierRegisterRowHTML', 'index.html');
  t.check(/ow-fig su-win\$\{r\.wins \? '' : ' su-nil'\}/.test(row),
    'a supplier who wins nothing is marked rather than shown a green zero');
  // The ring beside the count made the priced branch longer, and the
  // dash now carries an "Add a price" link after it -- the claim pinned
  // is unchanged: nothing priced, no count, a dash.
  t.check(/\$\{r\.priced\s*\n?\s*\?[\s\S]{0,400}?:\s*(dash\}|`\$\{dash\})/.test(row),
    'and one with nothing priced shows a dash, because "cheapest on none" is a claim the app cannot make without a price');

  /* .su-win and .su-win.su-nil do NOT tie -- the second is (0,2,0)
     against (0,1,0) -- which is the lesson from .sc-stat.zero applied
     rather than repeated: a rule whose only defence is document order
     is one media query away from flipping. */
  const winAt = src.indexOf('.su-win{');
  const nilAt = src.indexOf('.su-win.su-nil{');
  t.check(winAt > -1 && nilAt > -1, 'both rules exist');
  t.check(nilAt > winAt,
    'the quieter rule comes after the green one, and beats it on specificity as well as on order');
  t.check(/\.su-win\.su-nil\{color:var\(--ow-ink-600\);\}/.test(src),
    'a zero reads as an ordinary count, leaving green for suppliers who actually win something');
}

process.exit(t.done() ? 1 : 0);
