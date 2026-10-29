/*
 * What a recorded payment hands to its Paid screen (customers/paid { id }),
 * and the receipt it sends. Kept in memory: the Paid screen is the end of a
 * flow, never a place to come back to. The receipt goes into the customer's
 * own chat through act() (wa-send); when WhatsApp cannot reach them it waits
 * on Paid for Send by SMS or Try again (CU43).
 */
import { signal } from '@preact/signals';
import { money } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { replyWindow } from '../../../core/time.ts';
import type { Method } from '../../../core/types.ts';
import { act, chats } from '../shell/store.ts';
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
  /** Kept on this phone: recorded when signal comes back. */
  kept: boolean;
  receipt: { state: 'off' | 'sending' | 'sent' | 'failed'; at: number | null; chatId: number | null };
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
