/*
 * &state=stretched: the sample shop with more than the boards ever draw, so a screen that holds the
 * seed but not real data shows it (Kevin's phone: 20 faces in "Still to collect" ran off the sheet).
 * Not a board: a test of room. Same day and clock; on top of the default demo:
 *   - 30 customers owe (the first 30 background ones), each a bill of their own; 6 with long names
 *   - 20 payments to Grace today, 9-digit amounts among them
 *   - 20 live orders of Grace's across the stages, long names and 9-digit totals
 *   - 12 chats waiting for a reply, long names
 * Run idempotently (guarded by order #3000).
 */
import { initials, tintFor } from '../../names.ts';
import { dayOf } from '../../time.ts';
import type { Method, Stage } from '../../types.ts';
import { L, O } from './build.ts';
import { d, t } from './clock.ts';
import type { DemoState } from './index.ts';
import { GRACE, MUSA, RUTH, DENIS, SSALI } from './people.ts';

const LONG = [
  'Bweyogerere Building and Construction Supplies Limited',
  'Nakawa Industrial Area Hardware & Steel Fabricators',
  'Saint Kizito Secondary School Construction Committee',
  'Kampala Capital City Roads Maintenance Contractors',
  'Mama Shine Kabalagala Paints and Electricals Ltd',
  'Namanve Industrial Park Warehouse Builders (U)',
];
const STAGES: Stage[] = ['checking', 'buying', 'packing', 'road'];
const HOLDER: Record<string, string> = { checking: RUTH, buying: DENIS, packing: MUSA, road: SSALI };
const METHODS: Method[] = ['momo', 'bank', 'cash'];
/** Big and small: a 9-digit amount every few rows. */
const QTY = (i: number) => (i % 4 === 0 ? 3700 + i : 2 + (i % 9));

export function stretched(s: DemoState): void {
  const b = s.books;
  if (b.orders.some((o) => o.id === 3000)) return;
  const bg = b.customers.filter((c) => /^C1\d\d$/.test(c.id)).slice(0, 30);
  bg.slice(0, LONG.length).forEach((c, i) => { c.name = LONG[i]; c.initials = initials(LONG[i]); c.tint = tintFor(LONG[i]); });
  // 30 owe: a bill each, delivered and invoiced, from 5 to 64 days ago.
  bg.forEach((c, i) => {
    const day = d('2026-10-12', '12:00') - (i * 2) * 86400000;
    b.orders.push(O({ id: 3000 + i, customerId: c.id, by: GRACE, placedAt: day, stage: 'delivered', stageAt: day, deliveredAt: day, invoicedAt: day, lines: [L('cement-hima-50', QTY(i))] }));
  });
  // 20 payments to Grace today, on those bills.
  for (let i = 0; i < 20; i++) {
    const c = bg[i], at = t('8:00') + i * 7 * 60000, method = METHODS[i % 3];
    const amount = i % 4 === 0 ? 123456789 - i * 1000 : 15000 + i * 1000;
    b.payments.push({ id: 9500 + i, at, day: dayOf(at), amount, method, customerId: c.id, orderId: 3000 + i, by: GRACE, ref: method === 'momo' ? String(1209000000 + i) : method === 'bank' ? `STB ${90000 + i}` : '', qa: false });
  }
  // 20 live orders of Grace's.
  for (let i = 0; i < 20; i++) {
    const c = bg[i % LONG.length], stage = STAGES[i % 4], placed = t('9:00') - (i * 5) * 3600000;
    b.orders.push(O({ id: 3100 + i, customerId: c.id, by: GRACE, placedAt: placed, stage, stageAt: placed, holder: HOLDER[stage], deliverTo: stage === 'road' ? 'Site' : null, lines: [L('iron-g28-3m', QTY(i + 1)), L('cement-hima-50', 3)] }));
  }
  b.orders.sort((x, y) => x.id - y.id);
  // 12 chats waiting, long names.
  for (let i = 0; i < 12; i++) {
    const id = 3200 + i, at = t('10:00') + i * 60000, name = LONG[i % LONG.length] + (i >= LONG.length ? ' Site Office' : '');
    s.chats.push({ id, waId: `2567009${String(10000 + i)}`, phone: `0700 9${String(10 + i)} ${String(100 + i)}`, profileName: name, customerId: i < LONG.length ? bg[i].id : null, ownerId: GRACE, ownerAt: at, lastInAt: at, lastAt: at, lastReadAt: null });
    s.messages.push({ id: 'm-st-' + i, chatId: id, at, dir: 'in', kind: 'text', body: 'Please send 40 bags of Hima cement and 25 sheets of G28 to the Namanve site before Friday, and the bill', by: null, state: null });
  }
}
