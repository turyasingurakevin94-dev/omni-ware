/*
 * "Statement · on WhatsApp" (CU10's third act): what they owe, bill by bill,
 * sent into their own chat. Through act(), so with no signal it is kept on
 * the phone and sent when signal comes back. A shut 24-hour window sends it
 * as the shop's reply template (wa-send).
 */
import { isDataError } from '../../../core/datasource.ts';
import { money } from '../../../core/money.ts';
import { orderNo } from '../../../core/names.ts';
import { dayLabel, dayOf, replyWindow } from '../../../core/time.ts';
import type { Books, ChatBooks, Customer } from '../../../core/types.ts';
import { act, now } from '../shell/store.ts';
import { moneyOf, short } from './data.ts';

export function statementText(b: Books, c: Customer, today: string): string {
  const m = moneyOf(b, c, today);
  const lines = m.bills.map((x) => `${orderNo(x.id)} · ${dayLabel(x.day)} · ${money(x.left)}`);
  return [`${b.shop.name} · statement for ${c.name}`, ...lines, `Owes ${money(m.owes)}`].join('\n');
}

/** Sends it; resolves with the words for the toast. */
export async function sendStatement(b: Books, c: Customer, cb: ChatBooks | null): Promise<string> {
  const chat = cb ? cb.chats.find((x) => x.customerId === c.id) : null;
  if (!chat) return `${short(c.name)} has no WhatsApp chat yet`;
  const text = statementText(b, c, dayOf(now.value)), open = replyWindow(chat.lastInAt, now.value).open;
  try {
    const r = await act(open ? 'send' : 'sendTemplate', chat.id, text);
    return r.kept ? 'Kept on this phone · sends with signal' : `Statement sent to ${short(c.name)}`;
  } catch (e) {
    return isDataError(e) ? e.message : 'Not sent · try again';
  }
}
