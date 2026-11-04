'use strict';
/*
 * Take payment, from Today, by taps (test/e2e/sales-flows.cjs runs them).
 * FACTS §3.1: Kyaligonza & Sons owes 420,000 (#0533, past 21 days); 4 owe 1,910,000 in all.
 */
const { money, figureAfter } = require('./lib.cjs');

const PART = 150000;

/** The owed figure on a customer's own screen (Customers → the customer). */
async function owedOn(ph, name) {
  await ph.tab('customers');
  await ph.tap({ text: name });
  const s = await ph.text();
  await ph.tap('Back to Customers');
  return { n: figureAfter(s, 'Owes'), s };
}

/** 3a. Today → to collect → Take from Kyaligonza → Other 150,000 → Cash → slide → Paid; owed drops by exactly 150,000. */
async function takePayment(open) {
  const ph = await open('');
  const { tap, type, slide, check, text } = ph;
  await tap('to collect');
  let s = await text();
  check(/1,910,000/.test(s), 'pay: To collect shows 1,910,000 before', s.slice(0, 200));
  await tap('Take 420,000 from Kyaligonza and Sons');
  s = await text();
  check(/Kyaligonza & Sons · owes 420,000/.test(s), 'pay: Take payment opens on Kyaligonza, owes 420,000', s.slice(0, 200));
  await tap({ text: 'Other' });
  await type(String(PART), 'Amount Kyaligonza pays now');
  await tap({ text: 'Cash' });
  s = await text();
  check(new RegExp(`Slide to record ${money(PART)}`).test(s), `pay: the slide says "Slide to record ${money(PART)}"`, s.slice(-200));
  await slide();
  await ph.wait('Owes now');
  s = await text();
  check(/^Paid$/m.test(s), 'pay: Paid shows', s);
  check(s.includes(money(PART)) && /Cash/.test(s), `pay: Paid shows ${money(PART)} · Cash`, s);
  check(/Owes now\s*420,000\s*270,000/.test(s), 'pay: Paid shows owes now 420,000 → 270,000', s);
  await tap('Back to Today');

  // The customer's own screen and Today's To collect, after.
  const after = await owedOn(ph, 'Kyaligonza & Sons');
  check(after.n === 420000 - PART, `pay: Kyaligonza owes ${money(420000 - PART)} after (exactly ${money(PART)} less)`, after.s.slice(0, 160));
  await ph.tab('today');
  await tap('to collect');
  s = await text();
  check(s.includes(money(1910000 - PART)), `pay: To collect drops to ${money(1910000 - PART)}`, s.slice(0, 200));
  return ph;
}

/**
 * 3b. No signal (&offline=1: a tap cannot take the signal away): Today → Take payment → Kyaligonza → slide.
 * The payment is kept on the phone (CU44's words: "Not sent yet", "Records when signal comes back"),
 * Today counts it under Not sent yet, and nothing is taken off what Kyaligonza owes.
 */
async function takePaymentOffline(open) {
  const ph = await open('&offline=1');
  const { tap, slide, check, text } = ph;
  let s = await text();
  check(/Not sent yet\s*kept on this phone\s*2/.test(s), 'offline: Today starts with 2 not sent yet, kept on this phone', s.slice(0, 600));
  await tap({ sel: 'a.ow-needs:has-text("Take payment")' });
  await tap('Take 420,000 from Kyaligonza and Sons');
  await slide();
  await ph.wait('Records when signal comes back');
  s = await text();
  check(/Not sent yet/.test(s), 'offline: the payment shows Not sent yet', s);
  check(/Records when signal comes back/.test(s), 'offline: it says it records when signal comes back', s);
  check(!/^Paid$/m.test(s), 'offline: it does not claim Paid', s);
  // "Try again" with no signal: still kept (CU45).
  await tap('Try again');
  s = await text();
  check(/Not sent yet/.test(s), 'offline: Try again with no signal keeps it, not sent yet', s);
  await tap('Back to Today');
  s = await text();
  check(/Not sent yet\s*kept on this phone\s*3/.test(s), 'offline: Today now has 3 not sent yet, kept on this phone', s.slice(0, 600));
  const after = await owedOn(ph, 'Kyaligonza & Sons');
  check(after.n === 420000, 'offline: Kyaligonza still owes 420,000 (a kept payment is not taken off)', after.s.slice(0, 160));
  // Back online: the demo's signal is fixed for the page (src/core/demo/index.ts, flags.offline), so no tap
  // and no flag brings it back mid-run; the kept payment's send is not covered here.
  ph.note('back online not covered: the demo cannot regain signal mid-run (flags.offline is fixed per page load; src/core/demo/index.ts write())');
  return ph;
}

module.exports = { takePayment, takePaymentOffline };
