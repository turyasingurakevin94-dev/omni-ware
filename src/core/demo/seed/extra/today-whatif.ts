/*
 * The today tab's two what-ifs whose counts are their own (FACTS §1): names, tints, prices and
 * rhythms still follow FACTS; the counts are the boards'.
 *
 *   busy (TD02)      Sat 17 Oct 14:20: 38 live (11 · 6 · 14 · 7), 212 done this week; 22 need Grace:
 *                    take 9 (6,420,000, oldest 67 days), tell 4 (Kato's 3 new prices, the paint), 7 chats
 *                    (oldest 48 m, 2 new), 2 packing 2+ days; 3 not placed yet
 *   goal hit (TD08)  Thu 29 Oct 9:10: sold 36,220,000 (35M passed Wed 28 Oct); 9 live (2 · 1 · 4 · 2),
 *                    11 done; +2.1M on the move, 1.4M to collect; 1 needs her: 840,000, 23 days
 */
import { orderTotal } from '../../../money.ts';
import { at } from '../../../time.ts';
import type { Line, Order, Stage } from '../../../types.ts';
import type { DemoState } from '../index.ts';
import { L, O, charge } from '../build.ts';
import { d, t } from '../clock.ts';
import { GGABA, KATO, KYALIGONZA, LUBOWA, MUKONO, NANSANA } from '../orders-live.ts';
import { BRIAN, DENIS, GRACE, MUSA, RUTH, SSALI } from '../people.ts';
import type { TodayLocal } from './today.ts';

const HOLDER: Record<Stage, string | null> = { checking: RUTH, buying: DENIS, packing: MUSA, road: SSALI, delivered: null };
const CYCLE: [string, number][] = [['cement-hima-50', 2], ['wood-glue-1l', 5], ['pvc-half-6m', 7], ['tile-grout-2', 9]];
const bgId = (i: number) => 'C' + String(101 + i);

function live(id: number, cid: string | null, stage: Stage, stageAt: number, lines: Line[], placedAt: number = t('8:00')): Order {
  return O({ id, customerId: cid, placedAt, by: GRACE, stage, stageAt, holder: HOLDER[stage], lines, deliverTo: stage === 'road' ? 'Site' : null });
}

/** One of Kato's lines whose price Ruth changed (17,000 → 18,000), not told yet. */
function katoPriced(): Line[] {
  return [L('ridge-g28', 4, { priceBy: GRACE, priceNote: 'under', priceReview: { state: 'changed', price: 18000, was: 17000, by: RUTH, byName: 'Ruth Nakato', at: t('12:00') } })];
}

/** Every chat whose last word is theirs, answered. */
export function answerAll(s: DemoState, when: number): void {
  s.chats.forEach((c) => {
    const m = s.messages.filter((x) => x.chatId === c.id).sort((x, y) => x.at - y.at).pop();
    if (!m || m.dir !== 'in' || s.messages.some((x) => x.id === 'm-ans-' + c.id)) return;
    if (!c.ownerId) c.ownerId = BRIAN;
    s.messages.push({ id: 'm-ans-' + c.id, chatId: c.id, at: when, dir: 'out', kind: 'text', body: 'Thank you. Done.', by: c.ownerId, state: 'read' });
    c.lastAt = when;
  });
}

const notMyLive = (o: Order) => !(o.placedBy === GRACE && o.stage !== 'delivered' && !o.counter);

export function busy(s: DemoState, local: TodayLocal): void {
  const b = s.books;
  if (b.orders.some((o) => o.id === 2000)) return; // the afternoon is in already
  s.now = t('14:20'); b.at = s.now;
  // Kyaligonza's #0530 stays, one of the 14 packing (since this morning here), so his rhythm is FACTS': last order Tue 29 Sep, 4 days late.
  const k530 = b.orders.find((o) => o.id === 530);
  b.orders = b.orders.filter(notMyLive);
  if (k530) { k530.stageAt = t('11:00'); k530.stageLog = k530.stageLog.map((x) => (x.stage === 'packing' ? { ...x, at: t('11:00') } : x)); b.orders.push(k530); }
  let k = 0;
  const bgLine = () => { const [item, qty] = CYCLE[k++ % CYCLE.length]; return [L(item, qty)]; };
  const add = (stage: Stage, rows: [number, string | null, Line[] | null, number?][]) => rows.forEach(([id, cid, lines, at_]) => {
    const o = live(id, cid, stage, at_ ?? t('11:00'), lines || bgLine());
    if (cid === KATO) o.toldTotal = 68000;
    b.orders.push(o);
  });
  const bg = (from: number, to: number, base: number): [number, string, null][] => Array.from({ length: to - from + 1 }, (_x, i) => [to - i, bgId(base + i), null]);
  add('checking', [[611, KATO, katoPriced()], [610, MUKONO, null], ...bg(601, 609, 0)]);
  add('buying', [[621, MUKONO, null], [620, GGABA, null], ...bg(616, 619, 9)]);
  add('packing', [[645, LUBOWA, null, d('2026-10-14', '9:00')], [644, KATO, katoPriced(), d('2026-10-15', '9:00')], ...bg(633, 643, 13)]);
  add('road', [[655, MUKONO, null, t('12:00')], [654, GGABA, null, t('12:10')], [653, bgId(25), null, t('12:30')], [652, KATO, katoPriced(), t('12:40')],
    [651, bgId(26), null, t('12:50')], [650, bgId(27), null, t('13:00')], [649, bgId(28), null, t('13:10')]]);
  b.orders.filter((o) => o.id === 645 || o.id === 644).forEach((o) => { o.placedAt = d('2026-10-14', '8:30'); });
  // 212 done this week: the 8 of FACTS and 204 more, delivered Mon 12 – today, not billed yet.
  for (let i = 0; i < 204; i++) {
    const day = `2026-10-${12 + (i % 6)}`, when = at(day, `${9 + (i % 5)}:${String(10 + (i % 40)).padStart(2, '0')}`);
    b.orders.push(O({ id: 2000 + i, customerId: bgId(4 + (i % 28)), by: GRACE, placedAt: when - 3600000, stage: 'delivered', stageAt: when, deliveredAt: when, lines: [L('cement-hima-50', 1)] }));
  }
  // Take payment 9: Ggaba and Kyaligonza (FACTS) and seven more, past 21 days.
  [[0, 1200000, '2026-09-20'], [1, 1000000, '2026-09-15'], [2, 900000, '2026-09-10'], [3, 850000, '2026-09-05'], [4, 785000, '2026-08-30'], [5, 600000, '2026-08-25'], [6, 500000, '2026-08-20']]
    .forEach(([i, amount, day]) => { const c = b.customers.find((x) => x.id === bgId(i as number)); if (c) { c.owes = amount as number; c.debtLog = [charge(day as string, amount as number, null)]; } });
  // 7 chats waiting, oldest 48 m, 2 new numbers.
  const ask = (chatId: number, hm: string, body: string) => {
    s.messages.push({ id: `m-busy-${chatId}`, chatId, at: t(hm), dir: 'in', kind: 'text', body, by: null, state: null });
    const c = s.chats.find((x) => x.id === chatId);
    if (c) { c.lastInAt = t(hm); c.lastAt = t(hm); c.lastReadAt = null; }
  };
  s.chats.push({ id: 121, waId: '256702118440', phone: '0702 118 440', profileName: 'Wasswa', customerId: null, ownerId: null, ownerAt: null, lastInAt: t('14:12'), lastAt: t('14:12'), lastReadAt: null });
  ask(102, '13:32', 'G28 iron sheets, 60 pcs?'); ask(101, '13:40', 'Can it come to the Ntinda site?'); ask(103, '13:45', 'Is our order packed?');
  ask(104, '13:50', 'Is the maroon paint in?'); ask(109, '13:58', 'Send me the price of cement'); ask(107, '14:05', 'Do you have 3m iron sheets? How much?');
  ask(121, '14:12', 'Do you deliver to Kira?');
  // 3 not placed yet.
  const draft = (key: string, cid: string, name: string, lines: Line[], chatId: number | null) =>
    ({ key, at: t('13:00'), customerId: cid, client: { name, phone: '' }, lines: lines.map((l, i) => ({ ...l, lineId: i + 1 })), charges: [], credit: null, deliverTo: null, chatId });
  local.drafts = [
    draft('d-ks', KYALIGONZA, 'Kyaligonza & Sons', [L('ridge-g28', 5), L('nails-4-25kg', 1)], null),
    draft('d-lb', LUBOWA, 'Lubowa Builders', [L('iron-g28-3m', 60)], 102),
    draft('d-bb', bgId(0), 'Bukoto Builders', [L('cement-hima-50', 10)], null),
  ];
}

export function goalHit(s: DemoState, local: TodayLocal): void {
  const b = s.books;
  if (b.orders.some((o) => o.id === 720)) return; // Thu 29 Oct is in already
  s.now = at('2026-10-29', '9:10'); b.at = s.now;
  b.orders = b.orders.filter(notMyLive);
  const pvc = (n: number) => [L('pvc-half-6m', n)];
  const day = (dd: string, hm: string) => at(`2026-10-${dd}`, hm);
  // 9 live: 2 checking · 1 buying · 4 packing · 2 on the road; +2,100,000.
  b.orders.push(
    live(702, LUBOWA, 'checking', day('29', '8:40'), pvc(20), day('29', '8:40')), live(701, null, 'checking', day('29', '8:20'), pvc(20), day('29', '8:20')),
    live(703, KATO, 'buying', day('29', '8:00'), pvc(20), day('28', '15:00')),
    live(709, NANSANA, 'packing', day('29', '8:00'), pvc(20), day('28', '14:00')), live(708, MUKONO, 'packing', day('29', '8:00'), pvc(18), day('28', '13:00')),
    live(707, bgId(15), 'packing', day('29', '8:00'), pvc(18), day('28', '12:00')), live(706, bgId(16), 'packing', day('29', '8:00'), pvc(18), day('28', '11:00')),
    live(711, GGABA, 'road', day('29', '8:00'), pvc(17), day('28', '10:00')), live(710, KYALIGONZA, 'road', day('29', '8:30'), pvc(17), day('28', '9:00')),
  );
  // Billed since Sat 17 Oct: 14,000,000 last week; 3,500,000 Mon; 3,500,000 Tue; 2,000,000 Wed (35M passed); 740,000 today.
  const bills: [string, string, Line[]][] = [
    ...['19', '19', '20', '20', '21', '21', '22', '23', '23', '24'].map((dd) => [dd, '15:00', pvc(112)] as [string, string, Line[]]),
    ...['26', '26', '26', '26', '27', '27', '27', '27'].map((dd) => [dd, '15:00', pvc(70)] as [string, string, Line[]]),
    ['28', '14:00', pvc(80)], ['28', '16:00', pvc(80)], ['29', '8:30', [L('wood-glue-1l', 40)]],
  ];
  bills.forEach(([dd, hm, lines], i) => {
    const when = day(dd, hm);
    b.orders.push(O({ id: 720 + i, customerId: bgId(17 + (i % 15)), by: GRACE, placedAt: when - 86400000, stage: 'delivered', stageAt: when, deliveredAt: when, invoicedAt: when, lines, paid: -1 }));
  });
  // Who owes: Ggaba 840,000 from Tue 6 Oct (23 days), Kato 560,000 from Tue 20 Oct.
  // Every bill paid but these two debts (who owes reads the bills: core/owing.ts, ow_customer_balance).
  b.orders.forEach((o) => { if (o.invoiced) o.paid = Math.max(o.paid, orderTotal(o)); });
  b.customers.forEach((c) => { c.owes = 0; c.debtLog = []; });
  b.paymentAsks = b.paymentAsks.filter((a) => a.status !== 'sent');
  const owe = (cid: string, amount: number, dd: string) => { const c = b.customers.find((x) => x.id === cid); if (c) { c.owes = amount; c.debtLog = [charge(dd, amount, null)]; } };
  owe(GGABA, 840000, '2026-10-06'); owe(KATO, 560000, '2026-10-20');
  answerAll(s, day('29', '9:00'));
  local.told = ['ask:SRC-PAINT']; local.drafts = [];
}
