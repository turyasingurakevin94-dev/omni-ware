'use strict';
/*
 * Sell and the counter, from Today, by taps (test/e2e/sales-flows.cjs runs them).
 * Figures from docs/canvas/sales-agent/FACTS.md §4.1, §5, §6: the next number at 10:41 is #0558;
 * Cement · Hima 50kg 33,500 a bag; Wire nails 4" · 25kg ctn 96,000; Wood glue · 1L 18,500.
 */
const { money } = require('./lib.cjs');

const CEMENT = 33500, NAILS_CTN = 96000, GLUE = 18500;

/** 1. Sell: the red +, Kato, a carton of nails from the Fasteners aisle, 20 cement by search, one More, slide to place. */
async function sell(open) {
  const ph = await open('');
  const { tap, type, press, slide, check, text } = ph;
  await tap({ sel: 'a.ow-plus' });
  check((await ph.p.getByLabel('Customer name, phone or place').count()) > 0, 'sell: the red + asks who it is for');
  await type('Kato', 'Customer name, phone or place');
  await tap('New order for Kato');
  check(/Kato Construction/.test(await text()), 'sell: the order is Kato\'s', await text());

  // From an aisle: Fasteners → Wire nails 4" by the carton → Add → Done.
  await tap({ sel: 'a.sl-tile:has-text("Fasteners")' });
  await tap({ sel: '.sl-card2:has-text("Wire nails 4") button[role=radio]:text-is("ctn")' });
  await tap({ sel: '.sl-card2:has-text("Wire nails 4") [aria-label=Add]' });
  await tap('Done');
  // From search: "20 cement", Enter takes the best match.
  await type('20 cement', 'Add an item: type its name');
  await press('Enter');

  // Review: the two lines at the seed's prices, and the total on the slide's foot.
  const lines = await ph.p.locator('a.sl-line').allInnerTexts();
  const flat = lines.map((s) => s.replace(/\s+/g, ' '));
  const total = 20 * CEMENT + NAILS_CTN;
  check(flat.length === 2, 'sell: the order has 2 lines', flat.join(' / '));
  check(flat.some((s) => s.includes('Cement · Hima 50kg') && s.includes('20 bag × 33,500') && s.includes(money(20 * CEMENT))), 'sell: Cement · Hima 50kg 20 bag × 33,500 = 670,000', flat.join(' / '));
  check(flat.some((s) => s.includes('Wire nails 4" · 25kg ctn') && s.includes('1 ctn × 96,000')), 'sell: Wire nails 4" · 25kg ctn 1 ctn × 96,000 (from the aisle)', flat.join(' / '));
  const before = await text();
  check(before.includes(money(total)), `sell: the foot says ${money(total)}`, before.slice(-300));
  check(await ph.slideSays() === 'Slide to place · 2 items', 'sell: the slide says "Slide to place · 2 items"', await ph.slideSays());

  // More on the open line: the line and the dock follow the count at once (SL06), and the slide places that total.
  await tap({ sel: 'a.sl-line:has-text("Cement")' });
  await tap({ label: 'More' });
  const more = 21 * CEMENT + NAILS_CTN, after = await text();
  check(after.includes(money(21 * CEMENT)), `sell: after More the cement line says ${money(21 * CEMENT)} at once`, after.slice(-400));
  check(after.includes(money(more)), `sell: after More the dock says ${money(more)} at once`, after.slice(-300));

  await slide();
  await ph.wait('Placed');
  const placed = await text();
  check(/#0558/.test(placed), 'sell: Placed shows the next number, #0558', placed);
  check(placed.includes(money(more)), `sell: Placed shows the total ${money(more)}, the count the dock showed`, placed);
  check(/Kato Construction/.test(placed), 'sell: Placed names Kato', placed);

  // The order then shows in Orders.
  await tap('Back to Today');
  await ph.tab('orders');
  const found = await ph.orderRow('#0558');
  check(found, 'sell: #0558 is in Orders', await text());
  if (found) {
    const r = (await ph.p.locator('button.ow-orow-main:has-text("#0558")').first().innerText()).replace(/\s+/g, ' ');
    check(/Kato/.test(r) && r.includes(money(more)), `sell: the Orders row says Kato and ${money(more)}`, r);
    await tap({ sel: 'button.ow-orow-main:has-text("#0558")' });
    const o = await text();
    check(/Cement · Hima 50kg/.test(o) && /Wire nails 4"/.test(o), 'sell: #0558 opens with both lines', o);
  }
  // SL21: an order whose only line has no price yet totals "Price coming", never 0.
  const h = await open('');
  await h.tap({ sel: 'a.ow-plus' });
  await h.type('Kato', 'Customer name, phone or place');
  await h.tap('New order for Kato');
  await h.type('hinge', 'Add an item: type its name');
  await h.p.keyboard.press('Enter');
  await h.tap('Add · price coming');
  const tot = (await h.p.locator('.ow-dock-total').innerText()).trim();
  h.check(tot === 'Price coming', 'SL21: the hinge alone totals "Price coming", never 0', tot);
  // SL42: 60 Zawaina pair counted by the carton rounds up to 2 cartons (170,000: 50 × 1,700 a carton, as the agent app prices it); − takes it to 1; placed at 85,000.
  const u = await open('');
  await u.tap({ sel: 'a.ow-plus' });
  await u.type('Kato', 'Customer name, phone or place');
  await u.tap('New order for Kato');
  await u.type('60 zawaina', 'Add an item: type its name');
  await u.tap({ sel: '.sl-top-add' });
  await u.tap({ text: 'Zawaina hinge, normal 4 inch' });
  await u.tap('By the carton of 50, 85,000 a carton');
  let ut = await u.text();
  u.check(/2 carton × 85,000/.test(ut) && /170,000/.test(ut) && /1 carton = 50 pair · 100 pair in all/.test(ut), 'SL42: 60 pair by the carton is 2 carton × 85,000 = 170,000, "1 carton = 50 pair · 100 pair in all"', ut.slice(0, 500));
  await u.tap({ label: 'Fewer cartons' });
  ut = await u.text();
  u.check(/1 carton × 85,000/.test(ut) && (await u.p.locator('.ow-dock-total').innerText()).trim() === '85,000', 'SL42: − makes it 1 carton, and the dock says 85,000', ut.slice(0, 500));
  await u.slide();
  await u.wait('Placed');
  const up = await u.text();
  u.check(/85,000/.test(up) && /1 × 85,000/.test(up), 'SL42: Placed says 1 × 85,000, total 85,000', up.slice(0, 600));
  // SL43: the hinge's card in Doors & locks carries the agent app's Pair | Carton, the carton first (85,000/carton);
  // "+ 1 Carton" puts 1 carton × 85,000 on the order; Pair makes it "+ 1 Pair" at 1,700/pair.
  const w = await open('');
  await w.tap({ sel: 'a.ow-plus' });
  await w.type('Kato', 'Customer name, phone or place');
  await w.tap('New order for Kato');
  await w.tap('Browse the aisles');
  await w.tap({ text: 'Doors & locks' });
  const card = w.p.locator('.sl-card2:has-text("Zawaina")');
  let ct = (await card.innerText()).replace(/\s+/g, ' ');
  w.check(/85,000 ?\/carton/.test(ct) && /1 ?Carton/.test(ct) && (await card.locator('[role=radio][aria-checked=true]').innerText()).trim() === 'Carton', 'SL43: the hinge card starts on Carton, 85,000/carton, "+ 1 Carton"', ct);
  await w.tap({ sel: '.sl-card2:has-text("Zawaina") [role=radio]:text-is("Pair")' });
  ct = (await card.innerText()).replace(/\s+/g, ' ');
  w.check(/1,700 ?\/pair/.test(ct) && /1 ?Pair/.test(ct), 'SL43: Pair makes it 1,700/pair, "+ 1 Pair"', ct);
  await w.tap({ sel: '.sl-card2:has-text("Zawaina") [role=radio]:text-is("Carton")' });
  await w.tap({ sel: '.sl-card2:has-text("Zawaina") .sl-card2-add' });
  ct = (await card.innerText()).replace(/\s+/g, ' ');
  w.check(/In order/.test(ct) && /1 carton/.test(ct), 'SL43: added, the card says In order, 1 carton', ct);
  await w.tap('Done');
  const wl = (await w.p.locator('a.sl-line').allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  w.check(wl.some((x) => x.includes('Zawaina') && x.includes('1 carton × 85,000')), 'SL43: the order line is 1 carton × 85,000', wl.join(' / '));
  return ph;
}

/** 2a. Counter: cash with change (60,000 for 52,000 → 8,000), Sold, the receipt. */
async function counterCash(open) {
  const ph = await open('');
  const { tap, slide, check, text } = ph;
  await tap({ sel: 'a.ow-plus' });
  await tap('Counter sale');
  await tap('Add one Cement · Hima 50kg');
  await tap('Add one Wood glue · 1L');
  const due = CEMENT + GLUE;
  let s = await text();
  check(s.includes(money(due)), `counter: 2 items come to ${money(due)}`, s);
  await tap('60,000');
  s = await text();
  check(/Give change\s*8,000/.test(s), 'counter: 60,000 given shows Give change 8,000 before the slide', s.slice(-300));
  check(await ph.slideSays() === 'Slide to sell · 52,000', 'counter: the slide says "Slide to sell · 52,000"', await ph.slideSays());
  await slide();
  await ph.wait('Give change');
  s = await text();
  check(/^Sold/m.test(s) || /\bSold\b/.test(s), 'counter: Sold shows', s);
  check(/#0558 · 52,000 · cash/.test(s), 'counter: Sold says #0558 · 52,000 · cash', s);
  check(/They gave 60,000/.test(s) && /\n8,000\n/.test(s), 'counter: the change figure is 8,000 (They gave 60,000)', s);
  check(/7 sales · 464,000/.test(s), 'counter: Today at the counter becomes 7 sales · 464,000 (FACTS §5)', s);
  await tap('Receipt');
  s = await text();
  check(/Receipt/.test(s) && /Counter sale · #0558/.test(s), 'counter: the receipt is #0558', s);
  check(/Total\s*UGX 52,000/.test(s) && /Cash given\s*60,000/.test(s) && /Change\s*8,000/.test(s), 'counter: the receipt says Total 52,000, Cash given 60,000, Change 8,000', s);
  // KC26: the counter's search finds an item the shop lists with no price yet: Price coming, and it goes as an order.
  const g = await open('');
  await g.tap({ sel: 'a.ow-plus' });
  await g.tap('Counter sale');
  await g.type('gutter bracket', 'Add an item: type its name');
  const gs = await g.text();
  g.check(/Gutter bracket/.test(gs) && /Price coming/.test(gs) && !/doesn.t sell/.test(gs), 'KC26: "gutter bracket" finds the Gutter bracket · Price coming, never "the shop doesn\'t sell"', gs.slice(0, 400));
  return ph;
}

/** 2b. Counter: Mobile money with its transaction ID. */
async function counterMobile(open) {
  const ph = await open('');
  const { tap, type, slide, check, text } = ph;
  await tap({ sel: 'a.ow-plus' });
  await tap('Counter sale');
  await tap('Add one Cement · Hima 50kg');
  await tap('Add one Wood glue · 1L');
  await tap('Mobile');
  check(await ph.p.locator('.ow-knob').count() === 0, 'counter mobile: no slide until the transaction ID is in');
  await type('12045889301', 'Transaction ID');
  await slide();
  await ph.wait('Transaction ID');
  const s = await text();
  check(/#0558 · 52,000 · mobile/.test(s), 'counter mobile: Sold says #0558 · 52,000 · mobile', s);
  check(/Transaction ID\s*12045889301/.test(s), 'counter mobile: Sold shows the transaction ID 12045889301', s);
  return ph;
}

module.exports = { sell, counterCash, counterMobile };
