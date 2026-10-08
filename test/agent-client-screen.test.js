#!/usr/bin/env node
'use strict';
/*
 * One client, as a sheet over whatever screen you were on.
 *
 * The Customers tab answers "who", and answered nothing else: a name was a
 * row you could call, and that was the end of it. This screen is what
 * happens after you decide to look one of them up, and it answers two
 * questions in order -- is it worth going out there, and once you are,
 * what do you put in front of them.
 *
 * Everything on it is read off orders the app already holds. No fetch, so
 * it works with no signal like the rest of the app.
 *
 * THE THING IT REFUSES TO SAY is the one the mockup put on it in bold:
 * "six orders, never a missed payment". The agent app has no record of
 * whether a customer paid HIM. agentPaymentStatus and amountPaid are what
 * the AGENT owes the SHOP -- a different debt, in the other direction --
 * and there is no table for the other half. A screen that dressed one up
 * as the other would be telling an agent his worst payer is reliable, on
 * the screen he uses to decide whether to extend them credit. So the
 * screen stays quiet about it, and this file pins that it does.
 *
 * Run: node test/agent-client-screen.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent client screen');
const src = read('agent.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let f = null, err = null;
try {
  f = compileScope(
    [
      extractFunction(src, 'orderDate', 'agent.html'),
      extractFunction(src, 'clientRegulars', 'agent.html'),
      extractFunction(src, 'medianOf', 'agent.html'),
      extractFunction(src, 'usualQty', 'agent.html'),
      extractFunction(src, 'dayBlocksHTML', 'agent.html'),
      extractFunction(src, 'lateBy', 'agent.html'),
      extractFunction(src, 'lateLabel', 'agent.html'),
      extractFunction(src, 'firstWord', 'agent.html'),
    ],
    { esc },
    ['orderDate', 'clientRegulars', 'medianOf', 'usualQty', 'dayBlocksHTML', 'lateLabel', 'firstWord'],
  );
} catch (e) { err = e; }
t.check(!!f, `the screen's helpers compile${err ? ` (${err.message})` : ''}`);

// An order line as the submit function writes it: productName and the two
// prices, the agent's and the shop's.
const line = (id, qty, sell, cost, over) => Object.assign({
  productId: id, variantIdx: null, productName: id, qty, unit: 'pc',
  agentSellPrice: sell, sellPrice: cost,
}, over || {});
const ord = (date, items, over) => Object.assign({ date, items, voided: false, status: 'completed' }, over || {});

if (f) {
  /* ---------- 1. what "always buy" is allowed to mean --------------- */
  {
    // Two lines of the same product in ONE order is one order that
    // included it, not two. Counting lines would promote a single
    // split-delivery order into a habit.
    const twoLines = f.clientRegulars([
      ord('2026-08-01', [line('P1', 4, 100, 80), line('P1', 6, 100, 80)]),
    ]);
    t.check(twoLines.length === 0,
      'a product on two lines of ONE order is not a regular -- one order is not a pattern');

    const real = f.clientRegulars([
      ord('2026-08-01', [line('P1', 4, 100, 80), line('P2', 1, 50, 45)]),
      ord('2026-08-20', [line('P1', 6, 110, 80)]),
    ]);
    t.check(real.length === 1 && real[0].productId === 'P1',
      'a product in two SEPARATE orders is');
    t.check(real[0].orders === 2, 'and it knows how many of their orders held it');

    // A single-order client has no regulars at all. The heading would be a
    // lie on every one of them, and the order itself is on the screen
    // directly below.
    t.check(f.clientRegulars([ord('2026-08-01', [line('P1', 4, 100, 80)])]).length === 0,
      'a client who has ordered once has no regulars -- the heading would be a lie');
    t.check(f.clientRegulars([]).length === 0 && f.clientRegulars(null).length === 0,
      'and no orders at all does not throw');

    // A voided order never counted anywhere else in this app either.
    const voided = f.clientRegulars([
      ord('2026-08-01', [line('P1', 4, 100, 80)]),
      ord('2026-08-20', [line('P1', 4, 100, 80)], { voided: true }),
    ]);
    t.check(voided.length === 0, 'a voided order does not make a habit');
  }

  /* ---------- 2. the price shown is the LAST one he charged --------- */
  {
    const r = f.clientRegulars([
      ord('2026-06-01', [line('P1', 4, 100, 80)]),
      ord('2026-08-20', [line('P1', 4, 130, 80)]),
      ord('2026-07-10', [line('P1', 4, 115, 80)]),
    ])[0];
    t.check(r.lastRate === 130, 'the newest order sets the price, whatever order they arrive in');
    t.check(r.lastUnitEarn === 50,
      'and what it earned him is PER UNIT, so it pairs with the per-unit price beside it');

    // Ranked by how reliably they take it, then by recency.
    const ranked = f.clientRegulars([
      ord('2026-06-01', [line('A', 1, 10, 5), line('B', 1, 10, 5)]),
      ord('2026-07-01', [line('A', 1, 10, 5), line('B', 1, 10, 5)]),
      ord('2026-08-01', [line('A', 1, 10, 5)]),
    ]);
    t.check(ranked.map((x) => x.productId).join(',') === 'A,B',
      'the one they take every time comes first');
  }

  /* ---------- 3. median, not mean ----------------------------------- */
  /*
   * One bulk order should not move "usually 4" to "usually 11" for the
   * twenty ordinary ones around it, and one big job should not make a
   * client's typical order twice what they normally spend.
   */
  {
    t.check(f.usualQty([4, 4, 4, 4, 60]) === 4,
      'one outlier does not move the usual quantity (mean would be 15)');
    t.check(f.medianOf([4, 4, 4, 4, 60]) === 4, 'which is the median doing the work');
    t.check(f.medianOf([2, 4]) === 3, 'an even count takes the midpoint');
    t.check(f.medianOf([]) === 0 && f.medianOf(null) === 0, 'and nothing to average is 0, not NaN');
    t.check(f.usualQty([3]) === 3, 'a single figure is its own median');

    // The screen uses it for both "usually" and "typical".
    t.check(/medianOf\(orders\.map\(orderTotal\)\)/.test(code),
      'the typical order is a median too -- the mean is only right for the TOTAL he has earned');
    t.check(/stats\.count \? fmtCompactUGX\(Math\.round\(medianOf/.test(code),
      'and a client with no orders gets a dash rather than a measured zero');
  }

  /* ---------- 4. their rhythm, as day blocks ---------------------- */
  /*
   * One block a day since their last order: grey inside their own rhythm,
   * a bar where it ran out, amber for each day past it. The amber run IS
   * how late they are, readable without a sentence; the words beside it
   * say the same number.
   */
  {
    const cad = (avgGapDays, daysSince) => ({ avgGapDays, daysSince });
    const late = f.dayBlocksHTML(cad(14, 18));
    t.check((late.match(/<span class="late"><\/span>/g) || []).length === 4 && (late.match(/<span><\/span>/g) || []).length === 14,
      'four days past a fourteen-day rhythm is fourteen grey blocks, a bar, and four amber ones');
    t.check(/every 14 days/.test(late) && />\+4</.test(late), 'labelled with the rhythm and how far past it');
    t.check(f.lateLabel(cad(14, 18.7)).text === '4 days late',
      'and the words agree with the blocks -- whole days on both sides, so a late evening is not a day later in one and not the other');
    t.check(f.lateLabel(cad(21, 21.4)).text === 'Due today', 'exactly on the gap is due today, not "0 days late"');
    const soon = f.dayBlocksHTML(cad(21, 14));
    t.check(/class="ahead"/.test(soon) && /due in 7/.test(soon) && !/class="late"/.test(soon),
      'short of it, the days still to come are drawn open and counted forward -- nothing is amber');
    t.check(f.lateLabel(cad(21, 14)).text === 'Due in 7 days', 'and said the same way');
    const long = f.dayBlocksHTML(cad(60, 90));
    const n = (long.match(/<span(?: class="late")?><\/span>/g) || []).length;
    t.check(n <= 27, `a long rhythm is scaled to fit a phone, not drawn as ninety blocks (${n})`);
    t.check(/\+30/.test(long), 'while the label keeps the real number of days');
  }

  /* ---------- 5. the button has to fit a name ----------------------- */
  {
    t.check(f.firstWord('Ssekitoleko Hardware Ltd') === 'Ssekitoleko',
      'the CTA uses the name a person is called by -- the full one wraps');
    t.check(f.firstWord('  Kato  Construction ') === 'Kato', 'padding and double spaces do not break it');
    t.check(f.firstWord('') === 'them' && f.firstWord(null) === 'them',
      'and a nameless client still reads as a sentence');
  }
}

/* ---------- 6. what the screen must NOT claim ---------------------- */
/*
 * The mockup's rhythm line ended "six orders, never a missed payment".
 */
{
  const renderer = extractFunction(src, 'openClientSheet', 'agent.html') + extractFunction(src, 'dayBlocksHTML', 'agent.html');
  t.check(renderer.length > 0, 'the client sheet and its rhythm are found');
  // Scanned with every comment stripped. The note in agent.html explaining
  // why the claim is absent quotes the claim.
  const prose = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(!/missed payment|pays on time|never missed|good payer|reliable payer/i.test(prose),
    'nothing the app can RENDER claims the customer pays on time');
  t.check(!/agentPaymentStatus|amountPaid/.test(renderer),
    'and the sheet never reads the agent-owes-shop fields to imply it -- '
    + 'that is a different debt, in the other direction');
}

/* ---------- 7. wired in ------------------------------------------- */
{
  const sheet = extractFunction(src, 'openClientSheet', 'agent.html');
  t.check(/kind:'client'/.test(sheet) && /refresh: \(\)=> paint\(\)/.test(sheet),
    'the sheet repaints when the data under it refreshes');
  // A stale id off a cached snapshot must not leave a name-shaped gap.
  t.check(/if\(!c\)\{ sheet\.close\(\); return; \}/.test(sheet),
    'a client that has vanished under the sheet closes it rather than drawing a blank');
  t.check(/href="tel:\$\{esc\(c\.phone\)\}"/.test(sheet) && /https:\/\/wa\.me\//.test(sheet),
    'call and WhatsApp are one tap from the top of the sheet');
  // The whole point of arriving here.
  t.check(/\.ax-cta-dock\{position:sticky;bottom:0/.test(src) && /data-start/.test(sheet),
    'the order button stays in reach however long their history is');
  t.check(/\.btn\{[^}]*min-height:48px/.test(src) && /\.btn\{[^}]*box-sizing:border-box/.test(src),
    'and is full-sized, restoring border-box after all:unset so 48 means 48');
  t.check(/:focus-visible\{outline:/.test(src), 'with a visible focus ring');
}

/* ---------- 8. one tap into the order ------------------------------ */
/*
 * The fastest sale in the app: a product they always buy, at the quantity
 * they usually take and the price they paid last time.
 */
{
  const add = extractFunction(src, 'addRegular', 'agent.html');
  t.check(/const qty = usualQty\(r\.qtys\) \|\| 1;/.test(add), 'a regular goes in at their usual quantity');
  // Order lines record BASE quantity. "usually 50" of a 25-a-carton nail
  // is two cartons, and is shown that way; "usually 12" is twelve pieces.
  t.check(/const usePack = pq > 0 && qty % pq === 0;/.test(add) && /displayQty: usePack \? qty \/ pq : qty/.test(add),
    'shown in packs only when the usual is a whole number of them, since past orders record base quantities');
  t.check(/priceBase: r\.lastRate > 0 \? r\.lastRate : null/.test(add), 'at the price they were charged last time');
  t.check(/if\(!it\)\{ toast\(/.test(add),
    'a product that has left the catalogue says so rather than adding a line with no price');
  const sheet = extractFunction(src, 'openClientSheet', 'agent.html');
  t.check(sheet.indexOf('goToClientBasket(c);') < sheet.indexOf('await addRegular(r);'),
    'the item lands in THIS client\'s basket, not whoever was last in hand');
}

process.exit(t.done() ? 1 : 0);
