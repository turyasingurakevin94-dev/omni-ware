/*
 * What waits on Ruth in the demo (docs/canvas/manager/BRIEF.md): the eight asks of 09:40
 * and the later cards, each at its own moment (&at=HHMM; the latest moment at or
 * before it applies). After 09:59 the eight are answered (Today p4) and only the
 * moment's own cards wait.
 */
import type { Ask, Done } from '../types.ts';
import { t } from './shop.ts';

const base = (key: string, hm: string, askerId: string | null, orderId: number | null, standing = false) => ({ key, at: t(hm), askerId, orderId, standing });

/** 09:40: the eight, oldest first after the truck (BRIEF "Waiting on Ruth at 09:40"). */
export function morning(): Ask[] {
  return [
    { ...base('storecredit:551', '09:15', 'musa', 551, true), kind: 'storecredit', carrier: 'Ssali' },
    { ...base('return:ia-547', '06:40', 'brian', 547), kind: 'return', askId: 'ia-547', lines: [{ idx: 0, qty: 5 }], amount: 56_250, reason: 'Something else', note: '5 too many · they never used them' },
    { ...base('price:552:1', '07:30', 'denis', 552), kind: 'price', mode: 'up', idx: 1, asked: null, costWas: 24_000 },
    {
      ...base('loss:sr-31', '08:10', 'musa', null), kind: 'loss',
      reports: [{ id: 'sr-31', key: 'p-cement-50-kg', name: 'Cement 50 kg', unit: 'bag', qty: 3, why: 'damaged', note: 'Broken in the yard', photo: '08:09', cost: 34_000, shelf: 26 }],
    },
    { ...base('price:555:0', '08:35', 'grace', 555), kind: 'price', mode: 'under', idx: 0, asked: 46_000, costWas: null },
    { ...base('cancel:ca-556', '08:50', 'grace', 556), kind: 'cancel', askId: 'ca-556', why: 'Changed their mind', note: 'changed their mind' },
    { ...base('short:550', '09:00', 'musa', 550), kind: 'short' },
    { ...base('carton:rb-77', '09:25', 'denis', null), kind: 'carton', restockId: 'rb-77', name: 'Wall plugs', unit: 'pack', forOrder: 1, forShelf: 199, cost: 1_500, perMonth: 14.2 },
  ];
}

/** Today p4: the eight answered 09:41–09:59, and the morning's two. */
export function morningDone(all: boolean): Done[] {
  const d = (hm: string, word: string, sub: string, told: string[], auto = false): Done => ({ at: t(hm), word, sub, told, auto });
  const early = [d('08:30', 'Billed itself', '#0546 · 24 h after delivery', ['grace'], true), d('07:55', 'Approved', '#0549 · Iron sheet G28', ['brian'])];
  if (!all) return early;
  return [
    d('09:59', 'Shelf part OK', 'Wall plugs · 298,500', ['denis']),
    d('09:57', 'Bill what went', '#0550 · 1,710,000', ['musa', 'grace']),
    d('09:55', 'Cancelled', '#0556 · Nothing paid', ['grace', 'denis', 'musa']),
    d('09:52', 'Approved', '#0555 · 46,000', ['grace']),
    d('09:49', 'Written off', '3 Cement 50 kg · 102,000', ['musa']),
    d('09:46', 'Shop\'s price', '#0552 · 33,750', ['denis', 'faith']),
    d('09:43', 'Credit note raised', '#0547 · 56,250', ['brian', 'esther']),
    d('09:41', 'On credit · load it', '#0551 · 1.5M · 14 d', ['musa', 'grace']),
    ...early,
  ];
}

/** The later cards, each at its moment (HHMM). */
export const MOMENTS: { at: number; asks: () => Ask[] }[] = [
  {
    at: 1005, asks: () => [
      { ...base('bill:561', '09:20', null, 561), kind: 'bill', code: 'OWSML' },
      { ...base('price:562:0', '09:30', null, 562), kind: 'price', mode: 'coming', idx: 0, asked: null, costWas: null },
    ],
  },
  {
    at: 1015, asks: () => [
      { ...base('price:553:0', '10:05', 'brian', 553), kind: 'price', mode: 'coming', idx: 0, asked: null, costWas: null },
      {
        ...base('checkin:trip-1009', '10:10', 'musa', null), kind: 'checkin', tripId: 'trip-1009', runnerId: 'denis',
        lines: [
          { name: 'Cement 50 kg', unit: 'bag', brought: 20, counted: 20, cost: 34_000, place: 'Owino' },
          { name: 'PVC pipe 4 in', unit: 'pcs', brought: 12, counted: 11, cost: 28_000, place: 'Owino Plumbing' },
          { name: 'Iron sheet G28', unit: 'sht', brought: 56, counted: 56, cost: 38_000, place: 'Owino' },
        ],
        note: { text: '12 went on the truck at Owino.', at: t('10:11'), handoffId: 'bh-12' },
      },
    ],
  },
  { at: 1020, asks: () => [{ ...base('extra:sa-9', '10:17', 'musa', null), kind: 'extra', askId: 'sa-9', tripId: 'trip-1009', name: 'Cement 50 kg', unit: 'bags', qty: 2, onList: 20, cost: 34_000, from: 'Nakawa Cement Depot' }] },
  { at: 1120, asks: () => [{ ...base('counter:570:0', '11:17', 'grace', 570, true), kind: 'counter', idx: 0, asked: 40_000 }] },
  { at: 1125, asks: () => [{ ...base('agent:560', '11:05', 'peter', 560), kind: 'agent', cancel: false, lines: [{ idx: 0, from: 20, to: 12 }] }] },
  { at: 1140, asks: () => [{ ...base('limit:cq-4', '11:30', 'esther', 553), kind: 'limit', askId: 'cq-4', customerId: 'ggaba', amount: 3_000_000, days: 14, why: 'Pays every 2 weeks' }] },
  { at: 1220, asks: () => [{ ...base('credit:555', '12:15', 'grace', 555), kind: 'credit', why: 'age' }] },
  { at: 1310, asks: () => [{ ...base('credit:552', '13:05', 'faith', 552), kind: 'credit', why: 'nolimit' }] },
  { at: 1420, asks: () => [{ ...base('void:ia-545', '14:05', 'esther', 545), kind: 'void', askId: 'ia-545', amount: 320_000, reason: 'Entered twice', note: 'Entered twice' }] },
  { at: 1610, asks: () => [{ ...base('given:563', '15:40', null, 563), kind: 'given', idxs: [0] }] },
  {
    at: 1620, asks: () => [{
      ...base('count:sc-14', '16:20', 'musa', null), kind: 'count', countId: 'sc-14', aisle: 'Aisle B',
      lines: [
        { key: 'p-timber', name: 'Timber 2×4', system: 30, counted: 28, cost: 9_000 },
        { key: 'p-plugs', name: 'Wall plugs', system: 40, counted: 44, cost: 1_500 },
        ...['Nails 3 in', 'Nails 4 in', 'Hinges', 'Padlock', 'Screws 2 in', 'Wire', 'Sandpaper', 'Brush 2 in', 'Putty', 'Glue'].map((name, i) => ({ key: 'p-b' + i, name, system: 10 + i, counted: 10 + i, cost: 1_000 })),
      ],
    }],
  },
];

/** D-33 (&state=markup): Moses listed PVC pipe 4 in 20 minutes ago. */
export function markupAsk(nowHm: string): Ask {
  const [h, m] = nowHm.split(':').map(Number);
  const mins = h * 60 + m - 20;
  const hm = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return { ...base('markup:p-pvc', hm, 'moses', null), kind: 'markup', productId: 'p-pvc-pipe-4-in', name: 'PVC pipe 4 in', cost: 28_000, rivals: [34_000, 36_000], markup: 0.25 };
}
