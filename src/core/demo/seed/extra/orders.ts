/*
 * The orders tab's own additions to the demo, owned by the orders builder (no other tab edits it).
 *
 * FACTS §1 lets a few Orders boards show another moment of the same day; with `&clock=` the demo
 * plays the day to that moment, and only these moments are touched, so no other tab's what-if
 * changes:
 *   9:15        before Ruth voided #0537 (9:20): the copy still stands to be asked about (OR23)
 *   9:30        #0552 in Checking: Ruth kept 38,000 at 9:28, the hinge's price coming (OR05, OR17, OR18)
 *   9:50        #0552 in Buying: the wheelbarrows left the supplier 9:45, the hinge not found (OR06, OR10)
 *   13:30       #0552 on the road with Ssali since 13:20, paid by mobile and cash before it left (OR08)
 *   14:05       #0552 delivered at the Ntinda site (OR09)
 *   13:50       #0559 Lubowa placed; the cement's cost went up (shop 35,500), Ruth decides (OR12)
 *   15:05       Ruth set 35,000 a bag; #0559 on to Buying (OR13)
 * At a moment before 10:41 the orders placed after it are not placed yet.
 * Always: the return on #0548 is worded as the board words it ("damaged", OR22), and with
 * &state=empty nothing of Grace's was delivered this week either (OR04 "0 done").
 */
import { dayOf } from '../../../time.ts';
import type { Line, Order } from '../../../types.ts';
import type { DemoFlags } from '../../flags.ts';
import { L, O, P } from '../build.ts';
import { TODAY, t } from '../clock.ts';
import type { DemoState } from '../index.ts';
import { DENIS, GRACE, MUSA, RUTH, SSALI } from '../people.ts';

const MOMENTS = ['9:15', '9:30', '9:50', '13:30', '14:05', '13:50', '15:05'];

export function extra(s: DemoState, f: DemoFlags): void {
  const b = s.books;
  const ret = b.billAsks.find((a) => a.orderId === 548 && a.kind === 'credit');
  if (ret) ret.reason = 'Damaged';
  // FACTS §4.4: Ruth voided the copy #0537 today 9:20.
  const copy537 = b.orders.find((o) => o.id === 537);
  if (copy537 && copy537.voided) Object.assign(copy537, { voidedAt: t('9:20'), voidedBy: RUTH });
  // FACTS §4.5: #0498 (Kato, 24 Sep, Ruth's) is 1,505,000: 30 sheets, 2 wheelbarrows, 6 PVC pipes (OR03's Show 7 more).
  const o498 = b.orders.find((o) => o.id === 498);
  if (o498) {
    o498.lines = [L('iron-g28-3m', 30), L('wheelbarrow-hd', 2), L('pvc-half-6m', 6)].map((l, i) => ({ ...l, lineId: i + 1 }));
    o498.paid = 1505000;
  }
  if (f.state === 'empty') {
    const mon = '2026-10-12';
    b.orders = b.orders.filter((o) => !(o.placedBy === GRACE && o.stage === 'delivered' && o.deliveredAt != null && dayOf(o.deliveredAt) >= mon));
  }
  if (!f.clock || !MOMENTS.includes(f.clock)) return;
  const now = s.now;
  if (now < t('10:41')) b.orders = b.orders.filter((o) => o.placedAt <= now || o.counter);
  if (now < t('9:20')) { const copy = b.orders.find((o) => o.id === 537); if (copy) Object.assign(copy, { voided: false, voidedAt: null, voidedBy: null }); }
  const o552 = b.orders.find((o) => o.id === 552);
  if (o552) play552(o552, now);
  if (now >= t('13:50')) {
    const o = order559(now);
    b.orders.push(o);
    b.orders.sort((x, y) => x.id - y.id);
  }
  if (o552 && now >= t('13:20')) {
    b.payments.push({ id: 9201, at: t('13:15'), day: TODAY, amount: 1000000, method: 'momo', customerId: 'C001', orderId: 552, by: GRACE, ref: '1204611290', qa: false });
    b.payments.push({ id: 9202, at: t('13:16'), day: TODAY, amount: 810000, method: 'cash', customerId: 'C001', orderId: 552, by: GRACE, ref: '', qa: false });
  }
}

/** #0552's life (FACTS §4.2), at the moment asked. */
function play552(o: Order, now: number): void {
  const [sheets, barrows, hinge] = o.lines as [Line, Line, Line];
  if (now < t('9:31')) {
    Object.assign(o, { stage: 'checking', stageAt: t('9:14'), holderId: RUTH, stageLog: [{ stage: 'checking', at: t('9:14'), by: GRACE }] });
    [sheets, barrows, hinge].forEach((l) => { l.state = null; l.stateAt = null; });
    return;
  }
  if (now < t('10:05')) {
    Object.assign(o, { stage: 'buying', stageAt: t('9:31'), holderId: DENIS, stageLog: [{ stage: 'checking', at: t('9:14'), by: GRACE }, { stage: 'buying', at: t('9:31'), by: RUTH }] });
    sheets.state = null; sheets.stateAt = null;
    barrows.state = 'waiting'; barrows.stateAt = t('9:45');
    return;
  }
  if (now < t('13:20')) return;
  sheets.state = 'packed'; barrows.state = 'packed'; barrows.stateAt = t('10:50');
  o.payments = [P(1, t('13:15'), 1000000, 'momo', 9201), P(2, t('13:16'), 810000, 'cash', 9202)];
  o.paid = 1810000;
  o.stageLog = [...o.stageLog, { stage: 'road', at: t('13:20'), by: MUSA }];
  Object.assign(o, { stage: 'road', stageAt: t('13:20'), holderId: SSALI });
  if (now >= t('14:05')) {
    o.stageLog = [...o.stageLog, { stage: 'delivered', at: t('14:05'), by: SSALI }];
    Object.assign(o, { stage: 'delivered', stageAt: t('14:05'), deliveredAt: t('14:05') });
  }
}

/** #0559 Lubowa (FACTS §4.4): placed 13:50; the cement's cost went up; Ruth sets 35,000 at 15:05. */
function order559(now: number): Order {
  const set = now >= t('15:05');
  const cement = L('cement-hima-50', 20, { cost: 31500, shopPrice: 35500, priceBy: GRACE, priceNote: 'under', from: 'shelf', supplierId: '__stock__' });
  if (set) Object.assign(cement, { price: 35000, priceReview: { state: 'changed', price: 35000, was: 33500, by: RUTH, byName: 'Ruth Nakato', at: t('15:05') } });
  const timber = L('timber-4x2-12', 10, { from: 'supplier', supplierId: 'sup-demo', state: set ? null : 'waiting' });
  return O({
    id: 559, customerId: 'C006', placedAt: t('13:50'), by: GRACE, stage: set ? 'buying' : 'checking', stageAt: set ? t('15:05') : t('13:50'), holder: set ? DENIS : RUTH,
    log: set ? [{ stage: 'checking', at: t('13:50'), by: GRACE }, { stage: 'buying', at: t('15:05'), by: RUTH }] : [{ stage: 'checking', at: t('13:50'), by: GRACE }],
    lines: [cement, timber], deliverTo: 'Lubowa',
  });
}

