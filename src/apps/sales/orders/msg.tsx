/*
 * What Grace tells a customer about an order, built from the order's state (OR10, OR11; the
 * manifest: "the message is built from the order's state", no reason to pick). One sentence per
 * fact: a new price, where it is, what was not found, what is paid.
 */
import type { JSX } from 'preact';
import { orderTotal } from '../../../core/money.ts';
import { orderNo, phone9 } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Books, Chat, ChatBooks, Order } from '../../../core/types.ts';
import { custOf, dropped, member, shortItem, shortName } from './data.ts';
import { untold } from './view.ts';

export const sayMoney = (n: number): string => Math.round(n).toLocaleString('en-US');
const plural = (name: string, last = false): string => { const w = shortItem(name).toLowerCase(); return (last ? w.split(' ').pop() : w) + 's'; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function tellText(b: Books, o: Order): string {
  const who = shortName(b, o), total = orderTotal(o), out: string[] = [];
  const ch = o.lines.find(untold), skipped = !o.stageLog.some((s) => s.stage === 'checking');
  if (ch && ch.priceReview) out.push(`the ${plural(ch.name)} are ${sayMoney(ch.priceReview.price)} each, not ${sayMoney(ch.priceReview.was || 0)}, so the total is ${sayMoney(total)}${o.toldTotal ? `, not ${sayMoney(o.toldTotal)}` : ''}.`);
  const live = o.lines.filter((l) => l.state !== 'dropped');
  if (o.stage === 'checking') out.push('we are checking it now.');
  else if (o.stage === 'buying') {
    const ready = live.filter((l) => l.state !== 'waiting').map((l) => `the ${plural(l.name, true)}`), way = live.filter((l) => l.state === 'waiting').map((l) => `the ${plural(l.name, true)}`);
    out.push([ready.length ? `${ready.join(' and ')} ${ready.length > 1 || ready[0].endsWith('s') ? 'are' : 'is'} ready` : '', way.length ? `${way.join(' and ')} are on the way` : ''].filter(Boolean).join(' and ') + '.');
  } else if (o.stage === 'packing') out.push(skipped ? 'everything is on our shelf and we are packing it now.' : 'we are packing it now.');
  else if (o.stage === 'road') out.push(`it is on the way with ${(member(b, o.holderId)?.name || 'our driver').split(' ')[0]}.`);
  else out.push(`it was delivered at ${clock(o.deliveredAt || o.stageAt)}.`);
  const gone = dropped(o);
  if (gone.length) out.push(`We could not find the ${gone.map((l) => plural(l.name)).join(' or the ')}, so they are not in the total.`);
  const paid = o.paid >= total ? 'paid in full' : o.paid > 0 ? `${sayMoney(o.paid)} paid, ${sayMoney(total - o.paid)} to pay` : 'nothing paid yet';
  out.push(ch ? `${cap(paid)}.` : `Total ${sayMoney(total)}, ${paid}.`);
  return `Hello ${who}, about order ${orderNo(o.id)}: ` + out.map((s, i) => (i ? cap(s) : s)).join(' ');
}

/** The words, numbers and order numbers in mono, as the bubble draws them. */
export function MonoText(p: { text: string }): JSX.Element {
  return <>{p.text.split(/(#\d{4}|\d[\d,]*\d|\d)/).map((x, i) => (i % 2 ? <span key={i} class="mono or-m5">{x}</span> : x))}</>;
}

/** The customer's WhatsApp chat: theirs by customer, else by the order's phone. */
export function chatFor(b: Books, o: Order, cb: ChatBooks | null): Chat | null {
  if (!cb) return null;
  const c = custOf(b, o), p9 = phone9(c?.phone || o.client.phone);
  return cb.chats.find((x) => (o.customerId && x.customerId === o.customerId) || (p9 && phone9(x.phone) === p9)) || null;
}
