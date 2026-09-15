#!/usr/bin/env node
'use strict';
/*
 * The one-client screen.
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
      extractFunction(src, 'clientRhythmHTML', 'agent.html'),
      extractFunction(src, 'firstWord', 'agent.html'),
    ],
    { esc, ICON_CLOCK: '<svg class="icon"></svg>' },
    ['orderDate', 'clientRegulars', 'medianOf', 'usualQty', 'clientRhythmHTML', 'firstWord'],
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
    t.check(/stats\.count \? fmtNum\(Math\.round\(medianOf/.test(code),
      'and a client with no orders gets a dash rather than a measured zero');
  }

  /* ---------- 4. their rhythm, as a sentence ------------------------ */
  /*
   * On the list a "Due" mark is enough: twelve names, and you are
   * scanning. Here there is one name and the question is whether to drive
   * out there, which a pill cannot answer.
   */
  {
    const cad = (avgGapDays, daysSince, n) => ({
      avgGapDays, daysSince, lastDateKey: '2026-08-14', orders: new Array(n).fill(0),
    });
    const late = f.clientRhythmHTML(cad(21, 31, 6), { lastAt: '2026-08-14' }, 6);
    t.check(/10 days late/.test(late), 'past their own gap, it says how far past');
    t.check(/every <b>21 days<\/b>/.test(late) && /14 August/.test(late),
      'with the gap it is measured against and the date it is measured from');
    t.check(/6 orders so far/.test(late), 'and how much history that is drawn from');
    t.check(/fx-alert late/.test(late), 'and the card is marked');

    t.check(/Due today/.test(f.clientRhythmHTML(cad(21, 21, 6), {}, 6)),
      'exactly on the gap is due today, not "0 days late"');
    const soon = f.clientRhythmHTML(cad(21, 14, 6), {}, 6);
    t.check(/Due in about 7 days/.test(soon), 'and short of it, it counts forward instead');
    t.check(!/fx-alert late/.test(soon), 'without the mark, which would make every client look overdue');

    // Below two orders there is no gap to average, so there is nothing to
    // claim. cadence returns null and the screen says so.
    const once = f.clientRhythmHTML(null, { lastAt: '2026-08-14' }, 1);
    t.check(/ordered once/.test(once) && /not enough yet/.test(once),
      'one order admits it cannot tell you their rhythm');
    t.check(/14 August/.test(once), 'while still saying when it was');
    t.check(/No orders yet/.test(f.clientRhythmHTML(null, {}, 0)),
      'and none says that plainly');
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
  const view = (/<div id="ag_clientView"[\s\S]*?\n  <\/div>/.exec(src) || [''])[0];
  t.check(view.length > 0, 'the client view is found');

  const renderer = (/function clientRhythmHTML\([\s\S]*?\n}/.exec(src) || [''])[0]
    + (/function renderClientScreen\(\)\{[\s\S]*?\n}/.exec(src) || [''])[0];
  t.check(renderer.length > 0, 'and its renderers are found');
  // Scanned with every comment stripped. The note in agent.html explaining
  // why the claim is absent quotes the claim, and matching prose rather
  // than code has caught several checks in this suite before.
  const prose = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(!/missed payment|pays on time|never missed|good payer|reliable payer/i.test(prose),
    'nothing the app can RENDER claims the customer pays on time');
  t.check(!/agentPaymentStatus|amountPaid/.test(renderer),
    'and the screen never reads the agent-owes-shop fields to imply it -- '
    + 'that is a different debt, in the other direction');
}

/* ---------- 7. wired in ------------------------------------------- */
{
  t.check(/'ag_clientView'/.test(code) && /ALL_VIEWS = \[[^\]]*'ag_clientView'/.test(code),
    'the view is registered, so showing it hides the others');

  // The Call link sits inside the row that opens the screen. A thumb
  // aimed at the phone must not land on the screen behind it.
  const guard = code.indexOf("if(e.target.closest('.fx-call')) return;");
  const open = code.indexOf("closest('[data-client-open]')");
  t.check(guard > 0 && open > guard,
    'the Call link is handled BEFORE the row branch, so calling never opens the screen');

  // A stale id off a cached snapshot must not leave a name-shaped gap.
  t.check(/if\(!c\)\{ switchTab\('customers'\); return; \}/.test(code),
    'a client that has vanished under the screen sends you back to the list');

  // The whole point of arriving here.
  t.check(/\.fx-cta\{[^}]*position:fixed/.test(src) && /\.fx-cta\{[^}]*min-height:52px/.test(src),
    'the order button is pinned and full-sized -- the screen runs past a phone');
  t.check(/\.fx-cta\{[^}]*box-sizing:border-box/.test(src),
    'and restores border-box after all:unset, so 52 means 52');
  t.check(/\.fx-cta:focus-visible\{outline:/.test(src), 'with a visible focus ring');
}

/* ---------- 8. one tap into the order ------------------------------ */
/*
 * The fastest sale in the app: a product they always buy, the quantity
 * they usually take already in the field.
 */
{
  t.check(/openAddItemPanel\(item, \{ qty: Number\(row\.dataset\.qty\) \|\| 0 \}\)/.test(code),
    'tapping a regular carries its usual quantity into the add sheet');
  // Order lines record BASE quantity. A packed product whose sheet opens
  // on its pack selector would read "usually 12" as twelve PACKS.
  t.check(/if\(Number\(opts\.qty\) > 0\)\{ qtyEl\.value = String\(Number\(opts\.qty\)\); unitEl\.value = 'unit'; \}/.test(code),
    'and sets the unit selector to base with it, since past orders record base quantities');
  t.check(/if\(c && cartKey\(chosenClient\) !== cartKey\(c\)\) selectClient\(c\);/.test(code),
    'the item lands in THIS client\'s basket, not whoever was last in hand');
  // A regular can have been discontinued since they last bought it.
  t.check(/if\(!item\)\{ toast\(/.test(code),
    'a product that has left the catalogue says so rather than opening an empty sheet');
}

process.exit(t.done() ? 1 : 0);
