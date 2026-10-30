/*
 * The today tab's own additions to the demo, owned by the today builder (no other tab edits it).
 * Each change says which board needs it; every figure is FACTS.md's, or the board's own for a what-if
 * (FACTS §1 "Boards allowed to show another moment").
 *
 *   always            #0528 being checked by Esther (FACTS §3.1: an ask to Accounts on that bill, TD05);
 *                     what Grace's phone keeps (searches, what she opened lately: TD11, TD20); her pushes off on her first day
 *   &state=first-day  TD06, TD20: Thu 1 Oct 8:00 ("30 days left"); nobody's chat waits on her; no drafts,
 *                     no asks of hers
 *   &clock=15:40      TD07 all told: #0552 delivered 14:05 and paid; #0559 Lubowa placed 13:50 (Ruth's 880,000);
 *                     Kyaligonza and Ggaba paid their past-21-day bills (585,000); every chat answered; the paint told
 *   &clock=9:19       TD23, TD24: before Kato's pump was asked (9:20); his 9:18 message
 *   &state=busy       TD02 (today-whatif.ts)        &state=goal-hit   TD08 (today-whatif.ts)
 *   &state=test-record  TD25: a TEST order of Grace's at 10:30, kept and in no figure
 *
 * #0559 may be added by the Orders tab's seed too: whichever runs first adds it, the other finds it by its id.
 */
import { at } from '../../../time.ts';
import type { DemoFlags } from '../../flags.ts';
import type { DemoState } from '../index.ts';
import { L, O, P, pay } from '../build.ts';
import { d, t } from '../clock.ts';
import { GGABA, KYALIGONZA, LUBOWA, MUKONO } from '../orders-live.ts';
import { BRIAN, COUNTER, ESTHER, GRACE, MOSES, RUTH, SSALI } from '../people.ts';
import { answerAll, busy, goalHit } from './today-whatif.ts';

/** What the Today tab keeps on the phone (src/apps/sales/today/local.ts), seeded. */
export interface TodayLocal {
  told: string[];
  searches: string[];
  misses: { words: string; n: number; at: number }[];
  lately: { kind: 'order' | 'customer' | 'item'; id: string }[];
  bigText: boolean;
  drafts?: unknown[];
}

export function extra(s: DemoState, f: DemoFlags): void {
  const b = s.books, st = f.state;
  // TD05: #0528 is being checked by Esther (Ggaba's 125,000 inside what they owe).
  if (!b.paymentAsks.some((a) => a.orderId === 528)) {
    b.paymentAsks.push({ id: 'pa-0528', paymentId: null, customerId: GGABA, orderId: 528, what: 'bill', amount: 125000, status: 'sent', by: ESTHER, at: d('2026-10-16', '11:00') });
  }
  // TD17: Nansana's 560,000 by Mobile at 8:52 shows its transaction ID (only TD17 draws it).
  const p9002 = b.payments.find((p) => p.id === 9002);
  if (p9002) p9002.ref = '12045833167';
  // TD17 "This week in 4,884,000": what Grace herself took each day, Mon 12 – Sat 17 Oct: 853,000 · 1,450,000 ·
  // 289,000 · 958,000 · 290,000 · 1,044,000 (today, FACTS §5). Every amount and bill FACTS names stays as it is;
  // only who took Monday's and Friday's receipts changes (Brian), and Grace's own counter cash fills the rest.
  if (st !== 'first-day' && !b.payments.some((p) => p.id === 7101)) {
    b.payments.forEach((p) => { if (p.id === 7004 || (p.id >= 8000 && p.id <= 8007)) p.by = BRIAN; });
    ([[7101, '2026-10-12', 853000], [7102, '2026-10-13', 1101000], [7103, '2026-10-14', 147000], [7104, '2026-10-15', 958000], [7105, '2026-10-16', 290000]] as const)
      .forEach(([id, day, amount]) => b.payments.push({ id, at: d(day, '16:30'), day, amount, method: 'cash', customerId: null, orderId: null, by: GRACE, ref: '', qa: false }));
  }
  // TD14 "Or open an aisle": what a wheelbarrow is bought with in the shop's orders. Six September counter sales
  // with cement, two with PVC pipe (with FACTS' own orders: Cement 6 · Roofing 5 · Fasteners 2 · Plumbing 2 · Paint 1).
  if (!b.orders.some((o) => o.id === 450)) {
    for (let i = 0; i < 8; i++) {
      const at_ = d(`2026-09-${String(20 + i).padStart(2, '0')}`, '10:00');
      b.orders.push(O({ id: 450 + i, customerId: null, by: COUNTER, placedAt: at_, stage: 'delivered', stageAt: at_, deliveredAt: at_, invoicedAt: at_, counter: true,
        lines: [L('wheelbarrow-hd', 1), i < 6 ? L('cement-hima-50', 2) : L('pvc-half-6m', 2)], paid: -1 }));
    }
  }
  // TD06, TD11 "Sells most": the shop's counter sales of iron sheets, cement and nails, so that by money Roofing,
  // Cement and Fasteners sell most in September (TD06, first day of October: "last month") and in October so far
  // (TD11: "this month", ahead of Grace's emulsion paint). Counter sales are the counter team's: in none of Grace's figures.
  if (!b.orders.some((o) => o.id === 480)) {
    ([[480, '2026-09-05', 'iron-g28-3m', 110], [481, '2026-09-08', 'nails-4-25kg', 16], [485, '2026-09-12', 'cement-hima-50', 45],
      [482, '2026-10-03', 'iron-g28-3m', 210], [483, '2026-10-06', 'cement-hima-50', 270], [484, '2026-10-08', 'nails-4-25kg', 60]] as const).forEach(([id, day, item, qty]) => {
      const at_ = d(day, '12:00');
      b.orders.push(O({ id, customerId: null, by: COUNTER, placedAt: at_, stage: 'delivered', stageAt: at_, deliveredAt: at_, invoicedAt: at_, counter: true, lines: [L(item, qty)], paid: -1 }));
    });
  }
  // TD13 "Often with this hinge · in the shop's orders": 8 counter sales with the Zawaina hinge in September,
  // 7 of them with wood screws, 4 with a door handle set.
  if (!b.orders.some((o) => o.id === 470)) {
    for (let i = 0; i < 8; i++) {
      const at_ = d(`2026-09-${String(10 + i).padStart(2, '0')}`, '11:00');
      const lines = [L('hinge-zawaina-4', 4), ...(i < 7 ? [L('wood-screws-1', 1)] : []), ...(i % 2 === 0 ? [L('door-handle-set', 1)] : [])];
      b.orders.push(O({ id: 470 + i, customerId: null, by: COUNTER, placedAt: at_, stage: 'delivered', stageAt: at_, deliveredAt: at_, invoicedAt: at_, counter: true, lines, paid: -1 }));
    }
  }
  // TD21, TD22: each ask's steps with their day and who moved it (SourcingAsk has no log yet: open question),
  // and what a supplier answered. The fan was asked Tue 13 Oct, Moses looking since Wed (TD21: "Lubowa waits 4 days");
  // the paint was asked Mon 12 Oct and listed today 10:34 (TD22: Asked Mon · Looking Tue · Found Thu · Priced Fri).
  type Logged = (typeof b.asks)[0] & { log?: { status: string; at: number; by: string }[] };
  const fan = b.asks.find((a) => a.id === 'SRC-FAN') as Logged | undefined, paint = b.asks.find((a) => a.id === 'SRC-PAINT') as Logged | undefined;
  if (fan && !fan.log) {
    fan.createdAt = d('2026-10-13', '16:00'); fan.requests[0].at = fan.createdAt;
    fan.log = [{ status: 'asked', at: fan.createdAt, by: GRACE }, { status: 'looking', at: fan.stageAt, by: MOSES }];
    (fan.tried[0] as { answer?: string }).answer = 'none';
  }
  // TD22 "Send a photo of the tin": the paint's photo in the shop's bucket (the demo's 'aisle:<Aisle>' stands for it).
  const paintItem = paint && paint.itemId ? b.items.find((i) => i.id === paint.itemId) : undefined;
  if (paintItem && !paintItem.image) paintItem.image = 'aisle:' + paintItem.aisle;
  if (paint && !paint.log) {
    paint.createdAt = d('2026-10-12', '9:00'); paint.requests[0].at = paint.createdAt;
    paint.log = [{ status: 'asked', at: paint.createdAt, by: GRACE }, { status: 'looking', at: d('2026-10-13', '9:30'), by: MOSES },
      { status: 'found', at: d('2026-10-15', '11:00'), by: MOSES }, { status: 'priced', at: d('2026-10-16', '15:00'), by: RUTH }, { status: 'listed', at: paint.stageAt, by: MOSES }];
  }
  const local: TodayLocal = {
    told: [], searches: ['hinge', 'Kato', 'wheelbarow'], bigText: false,
    misses: [['ppr pipe 25mm', 3], ['ceiling fan 56', 2], ['solar pump', 2], ['gate hinge, heavy', 1], ['tile cutter', 1]].map(([w, n], i) => ({ words: w as string, n: n as number, at: t('9:00') - i * 3600000 })),
    lately: [{ kind: 'order', id: '552' }, { kind: 'customer', id: MUKONO }, { kind: 'item', id: 'cement-hima-50' }],
  };
  (s as DemoState & { today?: TodayLocal }).today = local;

  if (st === 'first-day') firstDay(s, local);
  else if (st === 'busy') busy(s, local);
  else if (st === 'goal-hit') goalHit(s, local);
  else if (st === 'test-record') testRecord(s);
  if (f.clock === '15:40') allTold(s, local);
  if (f.clock && s.now < t('9:20')) beforePump(s);
}

/** TD06, TD20: Grace's first day, Thu 1 Oct 8:00. */
function firstDay(s: DemoState, local: TodayLocal): void {
  const b = s.books;
  s.now = at('2026-10-01', '8:00'); b.at = s.now;
  s.chats.forEach((c) => { if (!c.ownerId) { c.ownerId = BRIAN; c.ownerAt = d('2026-09-30', '9:00'); } });
  b.asks = b.asks.filter((a) => !a.requests.some((r) => r.by === GRACE));
  s.push = false; local.drafts = []; local.searches = []; local.lately = [];
}

/** TD07: the calm afternoon at 15:40. */
function allTold(s: DemoState, local: TodayLocal): void {
  const b = s.books;
  const o552 = b.orders.find((o) => o.id === 552);
  if (o552) {
    o552.stage = 'delivered'; o552.stageAt = t('14:05'); o552.deliveredAt = t('14:05'); o552.holderId = SSALI;
    o552.stageLog.push({ stage: 'road', at: t('13:20'), by: null }, { stage: 'delivered', at: t('14:05'), by: null });
    o552.payments = [P(1, t('13:10'), 1000000, 'momo', 9201), P(2, t('13:10'), 810000, 'cash', 9202)]; o552.paid = 1810000;
    o552.lines.forEach((l) => { if (l.priceReview) l.priceToldAt = t('10:50'); });
  }
  if (!b.orders.some((o) => o.id === 559)) {
    b.orders.push(O({ id: 559, customerId: LUBOWA, placedAt: t('13:50'), by: GRACE, stage: 'checking', holder: RUTH,
      lines: [L('cement-hima-50', 20, { price: 35000, priceReview: { state: 'changed', price: 35000, was: 33500, by: RUTH, byName: 'Ruth Nakato', at: t('15:05') }, priceToldAt: t('15:10') }), L('timber-4x2-12', 10)] }));
  }
  const o551 = b.orders.find((o) => o.id === 551);
  if (o551) o551.holderId = RUTH;
  const paid = (cid: string, id: number, amount: number, orderId: number, hm: string) => {
    const c = b.customers.find((x) => x.id === cid);
    if (!c) return;
    b.payments.push({ id, at: t(hm), day: '2026-10-17', amount, method: 'cash', customerId: cid, orderId, by: GRACE, ref: '', qa: false });
    c.debtLog.push(pay('2026-10-17', amount, orderId, id)); c.owes -= amount;
  };
  paid(KYALIGONZA, 9203, 420000, 533, '12:40');
  paid(GGABA, 9204, 165000, 521, '14:30');
  answerAll(s, t('15:20'));
  local.told = ['ask:SRC-PAINT'];
}

/** TD23, TD24: 9:19, Kato has just asked for a solar water pump. */
function beforePump(s: DemoState): void {
  s.books.asks = s.books.asks.filter((a) => a.createdAt <= s.now);
  if (!s.messages.some((m) => m.id === 'm-pump')) {
    s.messages.push({ id: 'm-pump', chatId: 101, at: t('9:18'), dir: 'in', kind: 'text', body: 'Do you have a solar water pump, 1hp? We need 2.', by: null, state: null });
  }
}

/** TD25: a test record of Grace's, kept in the books and in no figure (0167). */
function testRecord(s: DemoState): void {
  const o = O({ id: 9558, customerId: null, client: { name: 'TEST Claude QA', phone: '' }, placedAt: t('10:30'), by: GRACE, stage: 'checking', lines: [L('pvc-half-6m', 4)] });
  o.qa = true;
  s.books.orders.push(o);
}
