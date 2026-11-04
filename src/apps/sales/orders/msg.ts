/*
 * What Grace tells a customer about an order, built from the order's state (OR10, OR11; the
 * manifest: "the message is built from the order's state", no reason to pick). One sentence per
 * fact: a new price, where it is, what was not found, what is paid.
 */
import { orderOwes, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo, phone9 } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Books, Chat, ChatBooks, Line, Order } from '../../../core/types.ts';
import { priceUntold, twinOf } from '../../../core/orders.ts';
import { backLines, byRole, custOf, dropped, member, openAsk, shortItem, shortName } from './data.ts';

export const sayMoney = (n: number): string => Math.round(n).toLocaleString('en-US');
/** "the iron sheets", "the PVC pipes", "the soft close hinges": the short name, sizes dropped, the last word made plural. */
const plural = (name: string, last = false): string => {
  const ws = shortItem(name).split(' ').filter((w) => !/[0-9"½¼¾]/.test(w)).map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()));
  return (last ? ws.slice(-1) : ws).join(' ') + 's';
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the message is about before the order's state: a return asked, a voided bill, an owing bill (each its own words). */
const aside = (b: Books, o: Order): 'return' | 'void' | 'owing' | null => (openAsk(b, o, 'credit') ? 'return' : o.voided ? 'void' : o.invoiced && o.paid > 0 && orderOwes(o) > 0 ? 'owing' : null);

/**
 * The line whose new price the order's message tells them, or null. Sending that message tells it, so the
 * send marks it told (markPriceTold), as Today's Tell and the order's own price tell (OR13) do.
 */
export function tellsPrice(b: Books, o: Order): Line | null {
  return aside(b, o) ? null : o.lines.find(priceUntold) || null;
}

export function tellText(b: Books, o: Order): string {
  const who = shortName(b, o), total = orderTotal(o), out: string[] = [], kind = aside(b, o);
  // A return asked: what is coming back, and who decides the credit (OR22).
  const ret = kind === 'return' ? openAsk(b, o, 'credit') : null;
  if (ret) {
    const back = backLines(o, ret), ruth = byRole(b, 'manager');
    const what = back.length ? back.map(({ line, n }) => `${n} ${line.unit}${n > 1 ? 's' : ''} of ${plural(line.name).replace(/s$/, '').toLowerCase()}`).join(' and ') : 'the items';
    const many = back.length > 1 || (back[0]?.n || 0) > 1;
    return `Hello ${who}, about order ${orderNo(o.id)}: ${what} ${many ? 'are' : 'is'} coming back${ret.reason ? `, ${ret.reason.toLowerCase()}` : ''}. ${firstWord(ruth?.name || 'The manager')} decides the credit note of ${sayMoney(ret.amount)}.`;
  }
  // A voided bill: struck out, nothing owed on it; a copy says which bill stands and where it is (OR29).
  if (kind === 'void') {
    const tw = twinOf(b.orders, o, true), vn = firstWord(member(b, o.voidedBy)?.name || byRole(b, 'manager')?.name || 'The manager');
    const kept1 = tw && tw.orig.id !== o.id ? tw.orig : null, left = kept1 ? orderOwes(kept1) : 0;
    return `Hello ${who}, about bill ${orderNo(o.id)}: ${kept1 ? `it was entered twice, the same as ${orderNo(kept1.id)}. ` : ''}${vn} struck it out, so nothing is owed on it.`
      + (kept1 ? ` ${orderNo(kept1.id)} of ${sayMoney(orderTotal(kept1))} ${left > 0 ? `has ${sayMoney(left)} left to pay` : 'is paid'}.` : '');
  }
  // An owing bill: what is paid and what is left (OR24's order).
  if (kind === 'owing') return `Hello ${who}, about bill ${orderNo(o.id)} of ${sayMoney(total)}: ${sayMoney(o.paid)} paid, ${sayMoney(orderOwes(o))} left to pay.`;
  const ch = tellsPrice(b, o), skipped = !o.stageLog.some((s) => s.stage === 'checking');
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

/** The customer's WhatsApp chat: theirs by customer, else by the order's phone. */
export function chatFor(b: Books, o: Order, cb: ChatBooks | null): Chat | null {
  if (!cb) return null;
  const c = custOf(b, o), p9 = phone9(c?.phone || o.client.phone);
  return cb.chats.find((x) => (o.customerId && x.customerId === o.customerId) || (p9 && phone9(x.phone) === p9)) || null;
}
