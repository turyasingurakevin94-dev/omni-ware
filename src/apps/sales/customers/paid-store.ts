/*
 * What a recorded payment hands to its Paid screen (customers/paid { id }),
 * and the receipt it sends. Kept in memory: the Paid screen is the end of a
 * flow, never a place to come back to. The receipt goes into the customer's
 * own chat through act() (wa-send); when WhatsApp cannot reach them it waits
 * on Paid for Send by SMS or Try again (CU43).
 */
import { effect, signal } from '@preact/signals';
import { money } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { replyWindow } from '../../../core/time.ts';
import type { Method } from '../../../core/types.ts';
import type { PayResult } from '../../../core/datasource.ts';
import { act, books, chats, discardKept, kept, now, onKeptRefused, onKeptSent } from '../shell/store.ts';
import { toast } from '../../../ui/toast.tsx';
import { dm } from './pay-parts.tsx';

export interface PaidLine { id: number; day: string; amount: number }

export interface Paid {
  key: string;
  customerId: string | null;
  name: string;
  initials: string;
  tint: string;
  phone: string;
  /** What went in the books; with a deposit, all they handed over. */
  amount: number;
  method: Method;
  ref: string;
  lines: PaidLine[];
  before: number;
  after: number;
  change: number;
  given: number;
  deposit: number;
  at: number;
  /** Not sent yet (kept on this phone): recorded when signal comes back. */
  kept: boolean;
  /** The outbox id of the kept write. */
  keptId: string | null;
  /** The server refused the kept write: its reason (CU46). */
  refused: string | null;
  /** The kept write was thrown away: nothing was recorded. */
  discarded: boolean;
  /** waiting: Receipt was on and the payment is not recorded yet; it goes once it records. */
  receipt: { state: 'off' | 'waiting' | 'sending' | 'sent' | 'failed'; at: number | null; chatId: number | null };
}

export const paidResults = signal<Record<string, Paid>>({});

export function putPaid(p: Paid): void {
  paidResults.value = { ...paidResults.value, [p.key]: p };
}

function patch(key: string, r: Partial<Paid['receipt']>): void {
  const p = paidResults.value[key];
  if (p) putPaid({ ...p, receipt: { ...p.receipt, ...r } });
}

export function receiptText(p: Paid, shop: string): string {
  const rows = p.lines.map((l) => `${orderNo(l.id)} · ${dm(l.day)} · ${money(l.amount)}`);
  return [`${shop} · receipt`, `${p.name} paid ${money(p.amount)}`, ...rows, ...(p.deposit ? [`Deposit · ${money(p.deposit)}`] : []), `Owes now ${money(p.after)}`].join('\n');
}

/** Send the receipt into their chat. No chat, or the shop's WhatsApp is not connected: it waits (CU43). */
export async function sendReceipt(key: string, shop: string, now: number): Promise<void> {
  const p = paidResults.value[key], cb = chats.value;
  if (!p) return;
  const chat = cb && p.customerId ? cb.chats.find((c) => c.customerId === p.customerId) : null;
  if (!cb || !cb.connected || !chat) { patch(key, { state: 'failed', chatId: chat ? chat.id : null }); return; }
  patch(key, { state: 'sending', chatId: chat.id });
  try {
    await act(replyWindow(chat.lastInAt, now).open ? 'send' : 'sendTemplate', chat.id, receiptText(p, shop));
    patch(key, { state: 'sent', at: now });
  } catch (_e) {
    patch(key, { state: 'failed' });
  }
}

/*
 * A kept payment is recorded only when the outbox says it went (onSent): then it reads Paid, takes the
 * books' answer, and the receipt that waited goes. Refused (onRefused): it keeps the server's reason, to fix
 * or discard (spec 06 Q5, CU46). Gone from the outbox without either: discarded, so it reads "Not recorded"
 * and its receipt is off.
 */
const byKept = (id: string): Paid | undefined => Object.values(paidResults.peek()).find((p) => p.keptId === id);

onKeptSent((id, value) => {
  const p = byKept(id);
  if (!p) return;
  const r = value as Partial<PayResult> | undefined;
  // A "Still no signal" from an earlier Try again no longer holds.
  if (toast.text === 'Still no signal') toast.hide();
  putPaid({ ...p, kept: false, keptId: null, refused: null, amount: r && typeof r.amount === 'number' ? r.amount : p.amount,
    after: r && typeof r.after === 'number' && p.customerId ? Math.max(0, r.after) : p.after });
  const b = books.peek();
  if (p.receipt.state === 'waiting') void sendReceipt(p.key, b ? b.shop.name : '', now.peek());
});

onKeptRefused((id, reason) => {
  const p = byKept(id);
  if (p) putPaid({ ...p, refused: reason });
});

effect(() => {
  const ids = new Set(kept.value.map((k) => k.id));
  Object.values(paidResults.peek()).forEach((p) => {
    if (!p.kept || !p.keptId || ids.has(p.keptId)) return;
    putPaid({ ...p, kept: false, keptId: null, discarded: true, receipt: { ...p.receipt, state: 'off' } });
  });
});

/*
 * Throw it away (CU46 → CU47): the screen turns Not recorded at once and the toast offers Undo for 10 s;
 * only then is the kept write discarded from the outbox. Undo puts the refused entry back as it was.
 */
const throwing = new Map<string, number>();

export function throwAway(key: string): void {
  const p = paidResults.peek()[key];
  if (!p || !p.keptId) return;
  const id = p.keptId, was = p;
  putPaid({ ...p, kept: false, keptId: null, discarded: true, receipt: { ...p.receipt, state: 'off' } });
  const timer = window.setTimeout(() => { throwing.delete(key); void discardKept(id); }, 10000);
  throwing.set(key, timer);
  toast.show('Thrown away', {
    undo: () => {
      const t0 = throwing.get(key);
      if (t0 == null) return;
      clearTimeout(t0); throwing.delete(key);
      putPaid(was);
    },
  });
}
