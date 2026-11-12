#!/usr/bin/env node
'use strict';
/*
 * The Sales app end to end: every main flow on next/sales.html?demo, from Today, by real taps
 * (a slide is a real drag), at 360 × 800, with zero console errors.
 *
 *   npm run e2e:sales                      (after npm run build:sales)
 *   npm run e2e:sales -- sell chats        only the flows named
 *
 * Flows (FACTS: docs/canvas/sales-agent/FACTS.md; tap paths reuse test/parity/<tab>.json):
 *   sell            red + → Kato → an aisle and a search → slide → Placed #0558 → in Orders
 *   counter-cash    Counter → 2 items → 60,000 cash → Sold, change 8,000 → receipt
 *   counter-mobile  Counter → 2 items → Mobile with its transaction ID → Sold
 *   pay             Today's to collect → Take → 150,000 cash → Paid; owed drops by exactly 150,000
 *   pay-offline     &offline=1: the payment is kept on the phone, not taken off what is owed
 *   tell-today      Today's Tell them → Send to Kato → Kato's new price is told
 *   tell-order      an order's Tell (OR10 on #0552, OR11 on #0556) → sent → told; #0559's paper (OR35) → sent → told
 *   chats           reply to Kato; the new number (CH14) → Take → Start order → the item once → placed
 *   give            Kato's chat → Give to Brian with a note → the handover shows
 *   wrong-return    #0548 Fix it (OR20) → items coming back (OR21) → asked Ruth → shows as asked
 *   wrong-pay       #0533 Fix it (OR24) → the cash payment should be Mobile 124,000 (OR25) → asked Esther → shows as asked
 *   resume          every Resume (a customer's page, Today's Not placed yet, the red +'s Still open) opens the draft's own lines
 *   fit             &state=stretched at 130% text under a 24 px clock bar: every tab, Your day, a customer, an order, a chat
 *                   (flows-fit.cjs: the tab labels, nothing under the bar, no words off the screen)
 *
 * Every flow also fails on any console error or pageerror, and on any screen wider than the
 * phone (scrollWidth > clientWidth). Buttons and links under 44 × 44 are listed, not failed.
 * A failure is a finding: never soften a check to get green (CLAUDE.md, the rebuild).
 */
const R = require('./runner.cjs');
const S = require('./flows-sell.cjs');
const M = require('./flows-money.cjs');
const T = require('./flows-talk.cjs');
const X = require('./flows-wrong.cjs');
const F = require('./flows-fit.cjs');
const Z = require('./flows-resume.cjs');

const FLOWS = {
  sell: S.sell,
  'counter-cash': S.counterCash,
  'counter-mobile': S.counterMobile,
  pay: M.takePayment,
  'pay-offline': M.takePaymentOffline,
  'tell-today': T.tellToday,
  'tell-order': T.tellOrder,
  chats: T.chats,
  give: T.give,
  'wrong-return': X.wrongReturn,
  'wrong-pay': X.wrongPay,
  fit: F.fit,
  resume: Z.resume,
};
R.main({ app: 'sales', flows: FLOWS });
