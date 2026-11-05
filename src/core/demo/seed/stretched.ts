/*
 * Two what-ifs that are not boards but tests of room (test/e2e/flows-fit.cjs, test/e2e/sales-room.cjs):
 *
 *   &state=stretched  more than any board draws, as a real shop has it: 150 customers (names such as "Hajat
 *                     @Faluk", "Mama 🌸 Shine Hardware", "😀😀😀 Emoji Only Shop" and 45-character ones), most
 *                     owing, some 9-digit bills; #2999 with 25 long-named lines; 16 more live orders today; 20
 *                     payments to Grace today; 40 chats with long messages, a long link and photos; Brian's
 *                     long display name. (Kevin's phone: 20 faces in "Still to collect" ran off the sheet.)
 *   &state=one        one of everything: one customer owing, one live order, one chat, one payment ("1 orders").
 *
 * Same day and clock; run once (guarded by order #2999, or by the shop holding one customer).
 */
import { orderTotal } from '../../money.ts';
import { addDays, dayOf } from '../../time.ts';
import type { Line, Message } from '../../types.ts';
import { initials, tintFor } from '../../names.ts';
import { C, L, O } from './build.ts';
import { d, t, TODAY } from './clock.ts';
import type { DemoState } from './index.ts';
import { BRIAN, GRACE } from './people.ts';

const LONG = [
  'Hajat @Faluk', 'Ambrose FEKO', 'Bright (PAM)', 'Nakawunde Construction & General Supplies Ltd',
  'Mama 🌸 Shine Hardware', 'Ssekandi-Mukwaya Builders (Mukono Branch Office)', 'Eng. Okello @ Kireka Site 2 🏗️',
  'Kiwanuka Josephine Nalubega Namuddu', 'St. Mary\'s Kitovu Hospital Works Dept.', 'ABC', 'Wasswa', '😀😀😀 Emoji Only Shop',
  'Twinomujuni Rwabwogo Bainomugisha Trading Co.',
];

function longLine(i: number, item = 'cement-hima-50'): Line {
  const names = [
    'Iron sheet G28 · 3m pre-painted maroon (Roofings brand, extra long)',
    'Wire nails 4" · 25kg carton (galvanised, bright, Steel & Tube)',
    'PVC pipe 4 inch class B pressure pipe 6 metre length grey',
    'Emulsion paint 20L Sadolin Super Gloss Brilliant White Interior',
    'Cement · Hima 50kg',
  ];
  return L(item, 3 + i * 7, { name: names[i % names.length] + (i > 4 ? ` #${i}` : '') });
}

export function stretched(s: DemoState): void {
  const b = s.books;
  if (b.orders.some((o) => o.id === 2999)) return;
    // 150 customers: 112 more, most owing, some of 9-digit sums, aged 14-90 days.
    let oid = 3000;
    for (let i = 0; i < 112; i++) {
      const name = i < LONG.length ? LONG[i] : `${LONG[i % LONG.length].split(' ')[0]} ${['Traders', 'Hardware & Paints Wholesale', 'Contractors', '(K) Ltd'][i % 4]} ${i}`;
      const id = 'X' + String(200 + i);
      b.customers.push(C({ id, name, initials: initials(name), tint: tintFor(name), phone: '0772 ' + String(100000 + i * 37).slice(-6).replace(/(\d{3})(\d{3})/, '$1 $2'), place: 'Kawempe North Division Mpererwe Zone', everyDays: 10 + (i % 20) }));
      const age = 14 + (i * 7) % 80, day = addDays(TODAY, -age), at = d(day, '10:00');
      const big = i % 9 === 0;
      const lines = big ? [L('cement-hima-50', 1, { price: 123456789 })] : [L('cement-hima-50', 5 + (i % 30)), L('iron-g28-3m', 3 + (i % 11))];
      b.orders.push(O({ id: ++oid, customerId: id, client: { name, phone: '' }, by: i % 2 ? GRACE : BRIAN, placedAt: at, stage: 'delivered', stageAt: at, deliveredAt: at, invoicedAt: at, lines, paid: i % 3 === 0 ? 1000 : 0 }));
    }
    // A live order with 25 lines of long names, 9 digits, today, Grace's.
    const lines = Array.from({ length: 25 }, (_, i) => longLine(i));
    lines[0] = L('iron-g28-3m', 3000, { name: 'Iron sheet G28 · 3m pre-painted maroon (Roofings brand, extra long)', price: 38000 });
    b.orders.push(O({ id: 2999, customerId: 'X203', client: { name: LONG[3], phone: '' }, by: GRACE, placedAt: t('9:30'), stage: 'packing', lines }));
    // More live orders today for Grace, long names, every stage.
    const stages = ['checking', 'buying', 'packing', 'road'] as const;
    for (let i = 0; i < 16; i++) {
      const cid = 'X' + String(200 + (i % LONG.length));
      b.orders.push(O({ id: 2900 + i, customerId: cid, client: { name: LONG[i % LONG.length], phone: '' }, by: GRACE, placedAt: t('8:' + String(10 + i * 2)), stage: stages[i % 4], lines: [L('cement-hima-50', 100 + i * 333), L('iron-g28-3m', 50 + i)] }));
    }
    // 20 payments today by Grace.
    for (let i = 0; i < 20; i++) {
      const cid = 'X' + String(200 + i);
      b.payments.push({ id: 9500 + i, at: t('9:' + String(10 + i * 2)), day: TODAY, amount: i === 0 ? 123456789 : 15000 + i * 98765, method: (['cash', 'momo', 'bank'] as const)[i % 3], customerId: cid, orderId: null, by: GRACE, ref: i % 3 ? 'TXN' + (1000000000 + i) : '', qa: false });
    }
    // 40 chats of Grace's, long messages, photos, most waiting.
    for (let i = 0; i < 40; i++) {
      const id = 500 + i, name = i < LONG.length ? LONG[i] : `Customer with a fairly long WhatsApp profile name ${i}`;
      const lastIn = t('10:' + String(40 - i).padStart(2, '0'));
      s.chats.push({ id, waId: '2567720' + String(10000 + i), phone: '0772 0' + String(10000 + i).slice(0, 2) + ' ' + String(10000 + i).slice(2), profileName: name, customerId: i < 13 ? 'X' + String(200 + i) : null, ownerId: i % 5 === 4 ? null : GRACE, ownerAt: d('2026-10-12', '9:00'), lastInAt: lastIn, lastAt: lastIn, lastReadAt: i % 2 ? lastIn : null });
      const msgs: Message[] = [
        { id: 'sx' + i + 'a', chatId: id, at: lastIn - 600000, dir: 'out', kind: 'text', body: 'Good morning. The price of iron sheets G28 3m is 38,000 each and we can deliver to the site on Friday.', by: GRACE, state: 'read' },
        { id: 'sx' + i + 'b', chatId: id, at: lastIn - 30000, dir: 'in', kind: 'image', body: '', by: null, state: null, media: 'aisle:Roofing' },
        { id: 'sx' + i + 'c', chatId: id, at: lastIn, dir: 'in', kind: 'text', body: i % 3 === 0 ? 'Hello please I need 40 iron sheets G28 3 metres, 20 bags of cement Hima, 10 cartons of 4 inch nails, 6 tins of maroon roof paint 20L and 2 wheelbarrows delivered to the Ntinda site behind the church before Friday morning, how much for everything together with transport? https://maps.google.com/?q=0.3476,32.6052&aVeryLongUnbrokenTokenWithoutAnySpacesAtAll1234567890' : 'Ok 👍', by: null, state: null },
      ];
      s.messages.push(...msgs);
    }
    // Long display names for the team (never email handles).
    const brian = b.members.find((x) => x.id === BRIAN);
    if (brian) brian.name = 'Brian Ssekandi-Mukwaya Junior';
}

export function one(s: DemoState): void {
  const b = s.books;
  if (b.customers.length === 1) return;
    // One of everything: one customer owing, one live order, one chat, one payment.
    const keepC = b.customers.find((c) => c.name.startsWith('Kato')) || b.customers[0];
    b.customers = [keepC];
    const live = b.orders.filter((o) => o.customerId === keepC.id && o.stage !== 'delivered').slice(0, 1);
    const bill = b.orders.filter((o) => o.customerId === keepC.id && o.invoiced && orderTotal(o) > o.paid).slice(0, 1);
    b.orders = [...live, ...bill];
    b.payments = b.payments.filter((p) => p.customerId === keepC.id && p.day === TODAY).slice(0, 1);
    if (!b.payments.length) b.payments = [{ id: 9999, at: t('9:00'), day: dayOf(t('9:00')), amount: 1000, method: 'cash', customerId: keepC.id, orderId: null, by: GRACE, ref: '', qa: false }];
    s.chats = s.chats.slice(0, 1);
    s.messages = s.messages.filter((x) => x.chatId === s.chats[0].id);
    b.promises = []; b.billAsks = []; b.paymentAsks = []; b.asks = b.asks.slice(0, 1);
}
