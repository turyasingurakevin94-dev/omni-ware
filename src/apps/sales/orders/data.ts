/*
 * What the Orders tab reads from the books, said once (boards OR01–OR26).
 * Pure functions over Books and a clock: the screens draw what these say.
 *
 *   the list      Grace's orders on the move (12) and delivered this week (8): "Orders 20"
 *   a row         who holds it and the one thing to say (Ruth decides, Not paid yet, 1 of 2 came …)
 *   an order      its customer, its lines' marks, what is still possible
 */
import { owingOf, takeWithHeld } from '../../../core/owing.ts';
import { daysInStage, LATE_DAYS, lineWaits, twinOf } from '../../../core/orders.ts';
import { orderOwes, orderTotal, paidOver } from '../../../core/money.ts';
import { firstWord, initials, isGenericName, orderNo } from '../../../core/names.ts';
import { addDays, clock, dayLabel, dayOf, daysApart, weekday } from '../../../core/time.ts';
import type { BillAsk, Books, Customer, Line, Member, Method, Ms, Order, Payment, PaymentAsk, Role, Stage, Tint } from '../../../core/types.ts';
import type { Face } from '../../../ui/Avatar.tsx';
import type { IconName } from '../../../ui/icons.tsx';

export const LIVE: Stage[] = ['checking', 'buying', 'packing', 'road'];

export const custOf = (b: Books, o: Order): Customer | null => (o.customerId ? b.customers.find((c) => c.id === o.customerId) || null : null);
export const orderOf = (b: Books, id: number): Order | null => b.orders.find((o) => o.id === id) || null;
export const member = (b: Books, id: string | null): Member | null => (id ? b.members.find((m) => m.id === id) || null : null);
export const byRole = (b: Books, r: Role): Member | null => b.members.find((m) => m.role === r) || null;
export const faceOfMember = (m: Member): Face => ({ initials: m.initials, tint: m.tint });
/**
 * Who made an ask, as its card says it: "You asked" with Undo for Grace's own; a teammate's says their name
 * and has no Undo (the server takes back only the asker's own: 0130 withdraw_payment_ask, invoice_asks).
 */
export function askedBy(b: Books, by: string): { mine: boolean; said: string } {
  const mine = by === b.me.id, m = member(b, by);
  return { mine, said: mine ? 'You asked' : `${m ? firstWord(m.name) : 'A teammate'} asked` };
}

/** The customer's face, or the walk-in's grey one. */
export function faceOf(b: Books, o: Order): Face {
  const c = custOf(b, o);
  return c ? { initials: c.initials, tint: c.tint } : { initials: initials(o.client.name || 'Walk-in'), tint: 't4' as Tint };
}
export const nameOf = (b: Books, o: Order): string => custOf(b, o)?.name || o.client.name || 'Walk-in';
/** "Kato", "Nansana", "Lubowa": the customer as Grace says it to them. */
export const shortName = (b: Books, o: Order): string => firstWord(nameOf(b, o));

/** The Monday the week started on (FACTS "this week": Mon 12 – Sat 17 Oct). */
export function weekStart(now: Ms): string {
  const d = dayOf(now), w = new Date(d + 'T00:00:00Z').getUTCDay();
  return addDays(d, -((w + 6) % 7));
}

/** Grace's own orders, the counter's and test rows left out. */
export const mine = (b: Books): Order[] => b.orders.filter((o) => o.placedBy === b.me.id && !o.qa && !o.counter);
export const isLive = (o: Order): boolean => o.stage !== 'delivered' && !o.cancelled && !o.voided;
export const liveOrders = (b: Books): Order[] => mine(b).filter(isLive);
export function doneThisWeek(b: Books, now: Ms): Order[] {
  const from = weekStart(now);
  return mine(b).filter((o) => o.stage === 'delivered' && !o.voided && !o.cancelled && o.deliveredAt != null && dayOf(o.deliveredAt) >= from);
}

/** The stages' counts as the head draws them (P03b: delivered is "done this week"). */
export function stageCounts(b: Books, now: Ms): Record<Stage, number> {
  const live = liveOrders(b), c = { checking: 0, buying: 0, packing: 0, road: 0, delivered: doneThisWeek(b, now).length } as Record<Stage, number>;
  live.forEach((o) => { c[o.stage]++; });
  return c;
}

/** The asks of Grace's that still wait on this order. */
export const openAsk = (b: Books, o: Order, kind: BillAsk['kind']): BillAsk | null =>
  b.billAsks.find((a) => a.orderId === o.id && a.kind === kind && a.status === 'sent') || null;

/** What a return ask brings back, line by line: from the ask's lines, else from its note ("Cement · Hima 50kg ×2"). Never guessed from the amount. */
export function backLines(o: Order, ask: BillAsk): { line: Line; n: number }[] {
  if (ask.lines && ask.lines.length) return ask.lines.map((x) => ({ line: o.lines[x.idx], n: x.qty })).filter((x) => x.line && x.n > 0);
  return (ask.note || '').split(/,\s*/).map((part) => {
    const m = /^(.*?)\s*×\s*(\d+)$/.exec(part.trim()), line = m ? o.lines.find((l) => l.name === m[1]) : undefined;
    return { line: line as Line, n: m ? Number(m[2]) : 0 };
  }).filter((x) => x.line && x.n > 0);
}

/** "10:16" today, "29 Sep" before (a row's time placed). */
export const placedWhen = (o: Order, now: Ms): string => (dayOf(o.placedAt) === dayOf(now) ? clock(o.placedAt) : dayLabel(o.placedAt).replace(/^\w+ /, ''));
/** "today 8:50", "Fri 15:10", "Mon 11:05": when it was delivered. */
export function doneWhen(at: Ms, now: Ms): string {
  if (dayOf(at) === dayOf(now)) return 'today ' + clock(at);
  return (daysApart(dayOf(at), dayOf(now)) < 7 ? weekday(at) : dayLabel(at)) + ' ' + clock(at);
}
/** "today 9:14", "Fri 9:05", "Mon 24 Aug": the order's line under its name. */
export function headWhen(at: Ms, now: Ms): string {
  if (dayOf(at) === dayOf(now)) return 'today ' + clock(at);
  return daysApart(dayOf(at), dayOf(now)) < 7 ? `${weekday(at)} ${clock(at)}` : dayLabel(at);
}

/** Lines that still count (a dropped line is in no total). */
export const kept = (o: Order): Line[] => o.lines.filter((l) => l.state !== 'dropped' && l.qty > 0);
export const dropped = (o: Order): Line[] => o.lines.filter((l) => l.state === 'dropped');
/** A line waits for Ruth's price. */
export const waitsRuth = (l: Line): boolean => l.state !== 'dropped' && lineWaits(l);

/** "Iron sheet", "Cement", "Wood glue", "Wire nails 4"": an item cut to its first words (FACTS §7). */
export function shortItem(name: string): string {
  return name.split(/ · |,/)[0].split(' ').filter((w) => !/^[A-Z]\d+$/.test(w)).join(' ');
}

export type RowTone = 'info' | 'warn' | 'bad' | 'good';
export interface RowStatus {
  text?: string;
  tone?: RowTone;
  face?: Face;
  /** A small mono chip before the words ("6 days", "2+ days"). */
  chip?: { text: string; tone: 'warn' | 'bad' };
  /** The little bar of lines that came (Buying). */
  bar?: { done: number; of: number };
  tick?: boolean;
  /** The one act on the row. */
  act?: 'take' | 'tell';
}

/** What a row says about its order: who holds it, or the one thing to know. */
export function rowStatus(b: Books, o: Order, now: Ms): RowStatus {
  const ruth = byRole(b, 'manager'), rf = ruth ? faceOfMember(ruth) : undefined;
  if (o.stage === 'delivered') {
    if (openAsk(b, o, 'credit')) return { text: 'Return asked', face: rf, tone: 'info' };
    if (openAsk(b, o, 'void')) return { text: 'Void asked', face: rf, tone: 'info' };
    return orderOwes(o) > 0 ? { text: 'Owes', tone: 'warn' } : { text: 'Paid', tone: 'good', tick: true };
  }
  if (openAsk(b, o, 'cancel')) return { text: 'Cancel asked', face: rf, tone: 'info' };
  const days = daysInStage(o, now);
  if (o.stage === 'checking') {
    if (o.lines.some(waitsRuth)) return { text: `${ruth ? firstWord(ruth.name) : 'Manager'} decides`, face: rf, tone: 'info' };
    if (o.paid < orderTotal(o)) return { text: 'Not paid yet', tone: 'warn', act: 'take' };
  }
  if (o.stage === 'buying') {
    const gone = dropped(o).length;
    if (gone) return { text: `${gone} not found`, tone: 'bad', chip: { text: `${Math.floor((now - o.placedAt) / 864e5)} days`, tone: 'warn' }, act: 'tell' };
    const came = o.lines.filter((l) => l.state === 'came').length;
    return { text: `${came} of ${o.lines.length} came`, tone: 'good', bar: { done: came, of: o.lines.length } };
  }
  if (days >= LATE_DAYS) return { chip: { text: `${days}+ days`, tone: 'bad' } };
  const h = member(b, o.holderId);
  if (o.stage === 'packing') return { text: `${h ? firstWord(h.name) : 'Store'} packing`, tone: 'info' };
  if (o.stage === 'road') return h ? { text: `${firstWord(h.name)} driving`, tone: 'info' } : { text: 'Ready to collect', tone: 'good' };
  return {};
}

/**
 * What the row's Take takes ("Take 1.1M"), and the bills it names for customers/pay, so the pill pays what it says
 * (core/owing.ts takeWithHeld, the one rule: the open bills nobody is checking, then this order). A walk-in's
 * order is only itself.
 */
export function takeFor(b: Books, o: Order, now: Ms): { amount: number; params: { customer: string; bills: string } | { customer: string; order: number } } {
  const c = custOf(b, o);
  if (!c) return { amount: orderOwes(o), params: { customer: '', order: o.id } };
  const t = takeWithHeld(owingOf(b, c, dayOf(now)), c.id, o);
  return { amount: t.amount, params: { customer: t.customer, bills: t.bills } };
}

/** Groups of rows, in the canvas's order: newest number first; delivered by bill, newest first, then not billed yet. */
export function sortRows(list: Order[], stage: Stage, oldest: boolean): Order[] {
  if (oldest) return list.slice().sort((x, y) => (stage === 'delivered' ? (x.deliveredAt || 0) - (y.deliveredAt || 0) : x.placedAt - y.placedAt));
  const key = (o: Order) => (stage === 'delivered' ? (o.invoicedAt ?? -1) : o.id);
  return list.slice().sort((x, y) => key(y) - key(x));
}

/** Which rows show before "Show N more": in All, a group over 3 shows its 2 largest; one stage shows 6. */
export function shownRows(rows: Order[], all: boolean): Order[] {
  if (all && rows.length > 3) {
    const keep = rows.slice().sort((x, y) => orderTotal(y) - orderTotal(x)).slice(0, 2);
    return rows.filter((o) => keep.includes(o));
  }
  return all ? rows : rows.slice(0, 6);
}

/** Find: by order number ("552", "#0552") or by customer name. */
export function findOrders(b: Books, q: string): { customer: Customer | null; orders: Order[] } {
  const t = q.trim().toLowerCase();
  if (!t) return { customer: null, orders: [] };
  const n = Number(t.replace(/^#/, ''));
  if (/^#?\d+$/.test(t)) {
    // A number search for a voided copy lists the bill that stands beside it (OR30).
    const hit = b.orders.filter((o) => !o.qa && (o.id === n || orderNo(o.id).includes(t)));
    const twins = hit.filter((o) => o.voided).map((o) => twinOf(b.orders, o, true)?.orig).filter((x): x is Order => !!x && !hit.includes(x));
    return { customer: null, orders: [...hit, ...twins] };
  }
  const c = b.customers.find((x) => !x.qa && x.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(t))) || null;
  if (c) return { customer: c, orders: b.orders.filter((o) => o.customerId === c.id && !o.qa && !o.voided && !o.cancelled) };
  return { customer: null, orders: b.orders.filter((o) => !o.qa && !isGenericName(o.client.name) && o.client.name.toLowerCase().includes(t)) };
}

/** How a payment came, as every Orders screen says and draws it (OR24, OR25, OR27). */
export const METHOD: Record<Method, { word: string; icon: IconName; tone: string }> = { cash: { word: 'Cash', icon: 'cash', tone: 'good' }, momo: { word: 'Mobile', icon: 'mobile', tone: 'warn' }, bank: { word: 'Bank', icon: 'bank', tone: 'info' } };

/** The fixes asked of Accounts on a payment (its method, its amount) while they wait: such a payment is not asked about again (OR32, OR33). */
export const payFixAsks = (b: Books, p: Payment): PaymentAsk[] => b.paymentAsks.filter((a) => a.paymentId === p.id && a.status === 'sent' && (a.what === 'method' || a.what === 'amount'));

/** What a payment should be, from its asks: { method, amount } as Accounts will correct it. */
export function payFixWant(p: Payment, asks: PaymentAsk[]): { method: Method; amount: number } {
  const m = asks.find((a) => a.what === 'method'), a = asks.find((x) => x.what === 'amount');
  return { method: ((m && (m.want.method as Method)) || p.method), amount: a && Number(a.want.amount) > 0 ? Number(a.want.amount) : p.amount };
}

/** What they owe now, which a payment fix moves (OR25 "They will owe", OR32 "then they owe"). */
export const owesNow = (b: Books, o: Order): number => custOf(b, o)?.owes ?? orderOwes(o);

/** An order's payments, oldest first (OR24's rows and its split bar). */
export const paysOf = (b: Books, o: Order): Payment[] => b.payments.filter((p) => p.orderId === o.id && !p.qa).sort((x, y) => x.at - y.at);

/** An order's payments with a fix asked of Accounts, each with its asks (OR32). */
export const payFixesOf = (b: Books, o: Order): { pay: Payment; asks: PaymentAsk[] }[] => paysOf(b, o).map((pay) => ({ pay, asks: payFixAsks(b, pay) })).filter((x) => x.asks.length > 0);

/** What they owe once Accounts makes a payment's asked fix (OR32 "then they owe", "438,000 once fixed"). */
export function owesOnceFixed(b: Books, o: Order, fix: { pay: Payment; asks: PaymentAsk[] }): number {
  return Math.max(0, owesNow(b, o) + fix.pay.amount - payFixWant(fix.pay, fix.asks).amount);
}

export const overAsk = (b: Books, p: Payment): PaymentAsk | null => b.paymentAsks.find((a) => a.paymentId === p.id && a.what === 'over' && a.status === 'sent') || null;
/** The order's payment that was paid over and not settled yet. */
export const overPaymentOf = (b: Books, o: Order): Payment | null => b.payments.find((p) => p.orderId === o.id && !p.qa && paidOver(b, p).over > 0) || null;
