'use strict';
/*
 * Something wrong, from Today, by taps (test/e2e/sales-flows.cjs runs them).
 * FACTS §4.4: #0548 Ggaba, 3 bags of cement and a tin of wood glue, 119,000, paid cash; 2 bags came back
 * torn, so the credit is 67,000 (asked of Ruth). #0533 Kyaligonza owes 420,000; the Wed 14 Oct
 * Cash 142,000 should be Mobile 124,000, so after Esther's correction they owe 438,000.
 * The seed already holds #0548's return ask (OR22), so the run first takes it back (Undo ask), as
 * test/parity/orders.json does to reach OR20.
 */

/** 7a. OR20 → OR21: #0548 → Fix it → Items coming back → 2 bags, damaged → Ask Ruth → shows as asked. */
async function wrongReturn(open) {
  const ph = await open('');
  const { tap, check, text } = ph;
  await ph.tab('orders');
  await tap({ sel: '[aria-label=Show] button:nth-child(6)' });
  await tap({ sel: 'button.ow-orow-main:has-text("#0548")' });
  await tap('Undo ask', 900);
  let s = await text();
  check(!/Return asked/.test(s) && /Fix it/.test(s), 'OR20: after Undo ask #0548 has no return asked and offers Fix it', s);
  await tap('Fix it');
  await tap('Items coming back');
  await tap('Cement · Hima 50kg');
  await tap({ label: 'More back' });
  await tap('Damaged');
  const sheet = await ph.all();
  check(/2\s*of 3 bag/.test(sheet) && /Credit to give back\s*67,000/.test(sheet), 'OR21: 2 of 3 bags back, credit 67,000', sheet.slice(-600));
  check(/of 119,000/.test(sheet), 'OR21: of 119,000', sheet.slice(-600));
  await tap('Ask Ruth for the credit note', 900);
  check(/Asked Ruth for the credit note/.test(await ph.all()), 'OR21: "Asked Ruth for the credit note" shows');
  s = await text();
  check(/Return asked/.test(s) && /Credit asked\s*67,000/.test(s), 'OR22: #0548 shows Return asked, Credit asked 67,000', s);
  check(/You asked\s*2 bags · damaged/.test(s), 'OR22: "You asked · 2 bags · damaged"', s);
  // It stays asked when the order is opened again.
  await tap('Back to Orders');
  await tap({ sel: '[aria-label=Show] button:nth-child(6)' });
  await tap({ sel: 'button.ow-orow-main:has-text("#0548")' });
  s = await text();
  check(/Return asked/.test(s) && /Credit asked\s*67,000/.test(s), 'OR22: still asked when #0548 is opened again', s);
  return ph;
}

/** 7b. OR24 → OR25: find #0533 → Fix it → the Cash payment → should be Mobile 124,000 with its ID → Ask Esther → shows as asked. */
async function wrongPay(open) {
  const ph = await open('');
  const { tap, type, check, text } = ph;
  await ph.tab('orders');
  await type('0533', 'Find an order');
  await tap({ sel: 'button.ow-corow:has-text("#0533")' });
  await tap({ label: 'Something wrong with this bill' });
  let sheet = await ph.all();
  check(/Which payment\?/.test(sheet) && /Cash · Wed 14 Oct/.test(sheet) && /142,000/.test(sheet), 'OR24: Which payment? lists Cash · Wed 14 Oct 142,000', sheet.slice(-700));
  await tap({ sel: 'button.or-pay:has-text("Cash")' });
  await tap({ sel: '[aria-label="How they paid"] button:nth-child(2)' });
  await type('124,000', 'The right amount');
  await type('1194026113', 'Mobile money transaction ID');
  sheet = await ph.all();
  check(/Payment recorded wrong/.test(sheet) && /They will owe\s*420,000\s*438,000/.test(sheet), 'OR25: they will owe 420,000 → 438,000', sheet.slice(-600));
  await tap('Ask Esther to correct it', 1000);
  check(/Asked Esther to correct it/.test(await ph.all()), 'OR25: "Asked Esther to correct it" shows');
  // Once the toast has gone and the bill is opened again, the ask shows as waiting on Esther,
  // and the same payment is not offered to be asked about again.
  await ph.p.waitForTimeout(6000);
  await tap('Back to Orders');
  if (!(await ph.p.locator('button.ow-corow:has-text("#0533")').count())) await type('0533', 'Find an order');
  await tap({ sel: 'button.ow-corow:has-text("#0533")' });
  const bill = (await ph.screen()).replace(/Fix it\s*ask Esther/, '');
  check(/Esther/.test(bill), 'OR25: #0533 shows the payment fix as asked of Esther when opened again (beyond the toast)', bill);
  await tap({ label: 'Something wrong with this bill' });
  sheet = await ph.all();
  const cash = /Cash · Wed 14 Oct[\s\S]{0,80}/.exec(sheet);
  check(cash && /asked|Esther is checking|sent/i.test(cash[0]), 'OR25: the Cash payment is marked asked in Which payment? (not open to a second ask)', cash ? cash[0] : sheet.slice(-600));
  return ph;
}

module.exports = { wrongReturn, wrongPay };
