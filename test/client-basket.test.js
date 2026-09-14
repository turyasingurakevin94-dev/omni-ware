#!/usr/bin/env node
'use strict';
/*
 * The basket, the send, and what the customer is told afterwards.
 *
 * The arithmetic that matters here is not the pricing -- the shop does
 * that again server-side and client-submit-order.test.js pins it. What
 * matters here is that the two numbers AGREE, and that where they cannot,
 * the customer is told before they find out at the counter:
 *
 *   - a quantity changed in the basket re-resolves against that line's own
 *     ladder, so raising 10 to 140 shows the bundle rate the shop will
 *     actually charge and not the loose one it was added at;
 *   - what an order does to their standing is said from facts the shop has
 *     already agreed, not guessed;
 *   - a price that moved between filling the basket and sending it is
 *     named, with the new figure, on the screen that confirms the order.
 *
 * Run: node test/client-basket.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client basket');
const src = read('client.html');
const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const NAMES = ['esc', 'money', 'plural', 'many', 'rungFor', 'basketTotal',
  'standingHTML', 'renderBasket', 'renderBasketBar', 'showSent', 'addToBasket', 'setBasketQty'];
const STUB_IDS = ['basketBody', 'browseBar', 'sentBody', 'basketSay', 'toBasket', 'basketWhere'];

function scope(state) {
  const nodes = {};
  STUB_IDS.forEach((id) => {
    nodes[id] = { id, innerHTML: '', textContent: '', value: '', hidden: false,
      onclick: null, addEventListener() {}, querySelectorAll: () => [] };
  });
  const shown = [];
  const env = {
    document: { getElementById: (id) => nodes[id] || null },
    basket: state.basket || [],
    accountData: state.account || {},
    basketWhere: state.where || '',
    item: state.item || null,
    itemQty: state.itemQty || 1,
    show: (s) => shown.push(s),
    lineKey: (p, v) => p + '::' + (v == null ? '' : String(v)),
    /* A stub rather than nothing. Section 9 below checks by reading the
       source, so it does not need this -- but without it, a page that
       touched localStorage would throw the moment addToBasket ran in
       section 5, and the file would die with a stack trace before the
       check that names the actual problem ever ran. A test that crashes
       where it should fail reports zero failures to anything counting
       them. */
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    /* renderBasket kicks the advice request off at the end. Stubbed
       because this file is about the basket's own arithmetic; the advice
       has its own file, and letting a fetch fire from here would make
       these checks depend on a network that is not there. */
    loadAdvice() {},
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'],
  };
  const fns = compileScope(NAMES.map(n => extractFunction(src, n, 'client.html')), env, NAMES);
  return { fns, nodes, shown, env };
}

const L = (name, qty, price, unit, tiers) => ({ key: name, productId: name, variantIdx: null,
  name, variantLabel: '', unit: unit || '', packUnit: '', packQty: 0, qty,
  unitPrice: price, tiers: tiers || [] });

/* ---------- 1. the total is the lines --------------------------------- */
{
  const basket = [L('Iron sheets', 140, 48500, 'sheet'), L('Ridge caps', 28, 22000, ''), L('Cement', 8, 39000, 'bag')];
  const { fns, nodes } = scope({ basket });
  t.check(fns.basketTotal() === 7718000, `the total sums the lines (${fns.basketTotal()})`);
  fns.renderBasket();
  const seen = words(nodes.basketBody.innerHTML);
  t.check(/6,790,000/.test(seen) && /616,000/.test(seen) && /312,000/.test(seen),
    'every line shows its own total');
  t.check(/Order total 7,718,000/.test(seen), 'and the order total is the sum of them');
  t.check(/48,500 a sheet/.test(seen), 'with the unit price under each name');
  t.check(/22,000 each/.test(seen), 'and "each" where there is no unit');
  fns.renderBasketBar();
  t.check(/3 items 7,718,000 Check/.test(words(nodes.browseBar.innerHTML)),
    `the bar carries the same figure (${words(nodes.browseBar.innerHTML)})`);
}

/* ---------- 2. an empty basket has no bar ----------------------------- */
{
  const { fns, nodes } = scope({ basket: [] });
  fns.renderBasketBar();
  t.check(nodes.browseBar.innerHTML === '', 'nothing floats over a browse with nothing in the basket');
}

/* ---------- 3. a quantity change re-prices against the ladder --------- */
/*
 * Added at 10 for the loose rate, raised to 140 in the basket. Leaving the
 * loose rate showing would put a figure on screen the shop is not going to
 * charge -- and the customer would find the difference on the invoice.
 */
{
  const ladder = [{ minQty: 1, unitPrice: 51000 }, { minQty: 12, unitPrice: 48500 }, { minQty: 60, unitPrice: 46000 }];
  const basket = [L('Iron sheets', 10, 51000, 'sheet', ladder)];
  const { fns } = scope({ basket });
  fns.setBasketQty('Iron sheets', 140);
  t.check(basket[0].qty === 140, 'the quantity changes');
  t.check(basket[0].unitPrice === 46000,
    `and the price follows the ladder down (${basket[0].unitPrice})`);
  fns.setBasketQty('Iron sheets', 5);
  t.check(basket[0].unitPrice === 51000, `and back up again (${basket[0].unitPrice})`);
}

/* ---------- 4. taking a line out -------------------------------------- */
/*
 * Observed through what gets RENDERED, not through the array handed in.
 * Taking a line out rebinds `basket` to a filtered copy, so a reference
 * held out here goes on pointing at the old array and reports that
 * nothing happened -- which is what the first version of this check did,
 * and it failed against correct code.
 */
{
  const { fns, nodes, shown } = scope({ basket: [L('A', 1, 100, ''), L('B', 2, 200, '')] });
  fns.renderBasket();
  t.check(/A/.test(words(nodes.basketBody.innerHTML)) && /B/.test(words(nodes.basketBody.innerHTML)),
    'both lines are there to begin with');
  fns.setBasketQty('A', 0);
  const left = words(nodes.basketBody.innerHTML);
  t.check(!/\bA\b/.test(left) && /\bB\b/.test(left),
    `a quantity of nought takes that line out and leaves the other (${left.slice(0, 80)})`);
  fns.setBasketQty('B', 0);
  t.check(shown.includes('scBrowse'),
    'and emptying the basket puts the customer back where things are, not on an empty screen');
  fns.renderBasketBar();
  t.check(nodes.browseBar.innerHTML === '', 'with nothing left floating over it');
}

/* ---------- 5. adding the same item twice ----------------------------- */
/*
 * The item screen shows a QUANTITY, not an increment. A customer who goes
 * back, sets 140 and taps Add again means 140 -- a basket quietly holding
 * 280 is found at the counter.
 */
{
  const ladder = [{ minQty: 1, unitPrice: 51000 }];
  const it = { productId: 'P1', variantIdx: null, name: 'Iron sheets', variantLabel: '', unit: 'sheet' };
  const priced = { available: true, unit: 'sheet', packUnit: '', packQty: 0, tiers: ladder };
  const basket = [];
  const first = scope({ basket, item: { it, priced }, itemQty: 40 });
  first.fns.addToBasket();
  t.check(basket.length === 1 && basket[0].qty === 40, 'the first Add puts the line in');
  const again = scope({ basket, item: { it, priced }, itemQty: 140 });
  again.fns.addToBasket();
  t.check(basket.length === 1, 'the second does not add a second line');
  t.check(basket[0].qty === 140, `it replaces the quantity rather than adding to it (${basket[0].qty})`);
}

/* ---------- 6. what the order does to their standing ------------------ */
{
  const total = 7718000;
  const say = (account) => words(scope({ basket: [], account }).fns.standingHTML(total));

  t.check(say({}) === '', 'with nothing agreed, nothing is claimed');
  t.check(/On your 30-day terms\./.test(say({ termsDays: 30 })), 'terms are stated where there are terms');
  t.check(/Cash on the day\./.test(say({ termsDays: 0 })),
    'and nought days is cash, not "no terms" — the strictest agreement in the book');

  const over = say({ termsDays: 30, creditLimit: 2000000, owed: 1240000 });
  t.check(/6,958,000 over your limit/.test(over),
    `over the limit says by how much, counting what is already owed (${over})`);
  t.check(/we will call you about it/.test(over),
    'and says what happens next rather than refusing');
  t.check(!/cannot|refuse|blocked/i.test(over),
    'nothing here refuses the order — the app does not enforce a limit and must not pretend to');

  const within = say({ termsDays: 30, creditLimit: 10000000, owed: 1240000 });
  t.check(/1,042,000 still to spare/.test(within),
    `within the limit says what is left (${within})`);
  t.check(/2,000,000/.test(say({ creditLimit: 2000000, owed: 0 })) === false,
    'the limit itself is not restated — the customer already has it on their account screen');
}

/* ---------- 7. the send carries quantities and nothing else ----------- */
{
  const send = src.slice(src.indexOf("document.getElementById('basketSend')"));
  const body = /body: JSON\.stringify\(\{[\s\S]*?\}\),/.exec(send);
  t.check(!!body, 'the send body is found');
  if (body) {
    t.check(/items: basket\.map\(l => \(\{ productId: l\.productId, variantIdx: l\.variantIdx, qty: l\.qty \}\)\)/.test(body[0]),
      'each line is sent as product, variant and quantity');
    ['unitPrice', 'sellPrice', 'total', 'price'].forEach((word) => {
      t.check(!new RegExp(`\\b${word}\\b`).test(body[0]), `and carries no ${word}`);
    });
  }
  /* Up to the CATCH BLOCK, not the first "catch" in the text -- the json
     parse carries a .catch() of its own, and slicing at that cut the
     check off before the line it was looking for. */
  const trySide = send.slice(0, send.indexOf('}catch(err){'));
  t.check(trySide.length > 0 && /basket = \[\];/.test(trySide),
    'a sent basket is emptied, so a second tap cannot send it again');
  t.check(/showSent\(/.test(trySide), 'and the customer is shown what was sent');

  /* The comparison itself, at the call site. showSent can be handed a
     perfectly good list of moved prices by a test and still never be
     handed one by the page -- which is exactly what a plant of
     `showSent(data, [])` proved: every check in section 8 stayed green
     while the customer was told nothing. */
  t.check(/const moved = \(data\.lines \|\| \[\]\)\.filter/.test(trySide),
    'the page compares the shop\'s lines against the basket it was showing');
  t.check(/Math\.round\(mineLine\.unitPrice\) !== Math\.round\(l\.unitPrice\)/.test(trySide),
    'on the unit price, rounded, so a fraction of a shilling is not news');
  t.check(/showSent\(data, moved\)/.test(trySide),
    'and hands the result to the screen that tells them');
}

/* ---------- 8. a price that moved is named ---------------------------- */
{
  const { fns, nodes } = scope({ basket: [] });
  const data = { ok: true, orderId: 412, total: 7718000,
    lines: [{ productId: 'a', variantIdx: null, name: 'Iron sheets', unit: 'sheet', unitPrice: 48500, qty: 140 }] };

  fns.showSent(data, []);
  const plain = words(nodes.sentBody.innerHTML);
  t.check(/Sent to the shop/.test(plain), 'a sent order says so');
  t.check(/Order 412/.test(plain), 'and names its number, which is what a customer rings about');
  t.check(/7,718,000/.test(plain), 'with the figure the SHOP priced it at');
  t.check(/What we have priced it at/.test(plain),
    'labelled as the shop\'s figure, because it is — the basket total was only ever an estimate');
  t.check(/Nothing is charged and nothing is booked until then/.test(plain),
    'and says plainly that nothing has happened yet');
  t.check(!/moved/.test(plain), 'nothing is said about prices moving when none did');

  fns.showSent({ ...data, total: 7800000 }, [{ name: 'Iron sheets', unitPrice: 49000, unit: 'sheet' }]);
  const moved = words(nodes.sentBody.innerHTML);
  t.check(/1 price has moved since you filled the basket/.test(moved),
    `a moved price is named (${(moved.match(/\d+ price[s]? ha[sv]e? moved/) || [])[0]})`);
  t.check(/Iron sheets is now 49,000 a sheet/.test(moved), 'with the item and the new figure');
  t.check(/The shop will go through it with you/.test(moved), 'and what happens about it');

  fns.showSent({ ok: true, orderId: 412, duplicate: true, lines: [], total: 0 }, []);
  const dup = words(nodes.sentBody.innerHTML);
  t.check(/You had already sent that/.test(dup), 'a duplicate send says so');
  t.check(/we have not written it twice/.test(dup), 'and that the shop has not doubled it');
  t.check(/It is order 412/.test(dup), 'naming the order that already exists');
  t.check(!/priced it at 0/.test(dup) && !/What we have priced/.test(dup),
    'and shows no total, because the reply to a duplicate carries none');
}

/* ---------- 9. the basket does not outlive the session ---------------- */
{
  t.check(/^let basket = \[\];$/m.test(src), 'the basket is held in a variable');
  t.check(!/localStorage[^\n]*basket|store\([^)]*basket/i.test(src),
    'never in storage, where it would outlive the tab on a shared handset');
  const out = src.slice(src.indexOf("document.getElementById('signOut').onclick"));
  /* To the "};" that starts a line, which is the one closing the handler.
     `accountData = {};` contains a "};" of its own and an indexOf for it
     cut the body two lines short of everything this section checks. */
  const body = out.slice(0, out.indexOf('\n};'));
  t.check(body.length > 200, `the sign-out handler is read whole (${body.length} chars)`);
  t.check(/basket = \[\]/.test(body), 'and signing out empties it');
  t.check(/accountData = \{\}/.test(body),
    'along with the terms and the balance, which are nobody else\'s business either');
}

process.exit(t.done() ? 1 : 0);
