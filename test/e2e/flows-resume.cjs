'use strict';
/*
 * Resume (test/e2e/sales-flows.cjs runs it): every "Resume" opens the order not placed yet with its own lines
 * (shell/nav.ts resumeOrder; ROUTES.md sell/order `draft`), never a new empty order. The demo keeps two
 * (FACTS §4.6): Kyaligonza · Ridge cap G28 5 + Wire nails 25kg 1 · 186,000; Lubowa · Iron sheet G28 60 · 2,280,000.
 */

/** The order's lines as Sell draws them. */
const lines = async (ph) => (await ph.p.locator('a.sl-line').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '));

async function resume(open) {
  const ph = await open('');
  const { tap, check } = ph;
  // From the customer's page (CU13, CU17).
  await ph.tab('customers');
  await tap({ text: 'Kyaligonza & Sons' });
  await tap({ sel: 'button:has-text("Resume order")' });
  let l = await lines(ph);
  check(l.length === 2 && /Ridge cap/.test(l.join()) && /Wire nails/.test(l.join()), "resume: Kyaligonza's page opens his draft, its two lines", l.join(' | '));
  check(/186,000/.test(await ph.text()), 'resume: …at 186,000');
  // CU13: Reply names the customer whole, as the board does.
  const ph4 = await open('');
  await ph4.tab('customers');
  await ph4.tap({ text: 'Lubowa Builders' });
  check(await ph4.p.locator('[aria-label="Reply to Lubowa Builders"]').count() === 1, 'CU13: Reply to Lubowa Builders (the whole name)');
  // From Today's "Not placed yet" (TD03).
  const ph2 = await open('');
  await ph2.tap('Resume Lubowa Builders order');
  l = await lines(ph2);
  check(l.length === 1 && /Iron sheet G28/.test(l[0]) && /60/.test(l[0]), "resume: Today's Lubowa row opens her draft, 60 iron sheets", l.join(' | '));
  // From the red +'s "Still open" (SL01).
  const ph3 = await open('');
  await ph3.tap({ sel: 'a.ow-plus' });
  await ph3.tap({ sel: 'a.sl-who-orow:has-text("Kyaligonza")' });
  l = await lines(ph3);
  check(l.length === 2 && /Ridge cap/.test(l.join()), 'resume: the red +\'s Still open opens the same draft', l.join(' | '));
  // SL01: Who's due for a customer with an order not placed yet opens that order, never a second one.
  const ph5 = await open('');
  await ph5.tap({ sel: 'a.ow-plus' });
  await ph5.tap({ sel: 'a.sl-who-drow:has-text("Lubowa")' });
  l = await lines(ph5);
  check(l.length === 1 && /Iron sheet G28/.test(l[0]) && /60/.test(l[0]), "SL01: Who's due Lubowa opens her draft, 60 iron sheets", l.join(' | '));
  return ph;
}

module.exports = { resume };
