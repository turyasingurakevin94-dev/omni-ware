/*
 * The money rules Sales needs, once (docs/spec/02-money.md). Each rule names
 * its source. The server (0165, 0169) holds the same rules; these are the
 * phone's copy for what it shows before the server answers, and must agree
 * with it (Kevin's answers in spec 02 §8).
 *
 * Pure functions over plain numbers and the types in types.ts: no data
 * source, no clock (the caller passes `today`), so tests import them as they
 * are (test/sales-core-money.test.js).
 */
import type { Charge, Customer, Day, Line, Order, UGX } from './types.ts';

/* ---------------- whole shillings ---------------- */

/** Whole shillings: round half away from zero, never -0. spec 02 §1 "Whole shillings on screen" (sales.html:3644 n0). */
export function whole(n: number | null | undefined): UGX {
  const v = Math.round(Number(n) || 0);
  return v === 0 ? 0 : v;
}

/** "1,250,000": an amount someone acts on is written in full (BRIEF.md "Money"; sales.html n0). */
export function money(n: number | null | undefined): string {
  return whole(n).toLocaleString('en-US');
}

/**
 * "1,000 UGX", blank when empty: the one writer Kevin chose (spec 02 §8 Q3).
 * The canvas draws most figures without "UGX" (the hero puts it in front, small):
 * use money() there and this where the currency must be said.
 */
export function ugx(n: number | null | undefined): string {
  if (n == null || (typeof n === 'number' && Number.isNaN(n))) return '';
  return money(n) + ' UGX';
}

/**
 * "1.2M", "734k": a tile or summary may shorten (BRIEF.md "Money"). The canvas writes millions with one
 * decimal ("+3.2M", "1.9M", "6.1M", "35M") and two where a rate needs them ("1.61M a day", Goal "3.24M"):
 * pass digits = 2 there. Trailing zeros go. From 10,000: thousands with "k" ("734k", "500k"). Below: in full.
 * sales.html:3647 short wrote two decimals under 10M; the canvas (approved 29 Oct) wins for the new app.
 */
export function short(n: number | null | undefined, digits: number = 1): string {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(digits).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e4) return Math.round(v / 1e3) + 'k';
  return money(v);
}

/** A signed amount: "+3,240,000", "−1,000" (true minus). */
export function signed(n: number): string {
  const v = whole(n);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));
}

/* ---------------- an order's total ---------------- */

/**
 * A line priced at all? price null is "Price coming" and in no total (spec 02 §2 linePriceToConfirm; §8 Q1, Q4).
 * Whether a line has a price is decided once, where the line is made (supabase/rows.ts uses price.ts).
 */
export function linePriced(l: Line): boolean {
  return l.price != null && l.price >= 0;
}

/** One line: round(max(0, qty) × max(0, price)), whole before adding. spec 02 §2 goods; 0165:73 ow_order_total. */
export function lineTotal(l: Line): UGX {
  if (!linePriced(l)) return 0;
  return whole(Math.max(0, l.qty) * Math.max(0, l.price as number));
}

/**
 * Goods: the priced lines, each rounded; a line settled to 0 or dropped (not found) left out.
 * spec 02 §2, §8 Q1; a dropped line leaves payload.items for droppedLines (spec 01 §4a).
 */
export function goodsTotal(lines: Line[]): UGX {
  return lines.reduce((s, l) => s + (l.qty > 0 && l.state !== 'dropped' ? lineTotal(l) : 0), 0);
}

/** One charge: percent of the goods, or a fixed figure; 0 when its value is 0 or less. spec 02 §2 chargeAmount (sales.html:4577). */
export function chargeAmount(ch: Charge, goods: UGX): UGX {
  const v = Number(ch.value) || 0;
  if (!(v > 0)) return 0;
  return ch.type === 'percent' ? whole(goods * v / 100) : whole(v);
}

export function chargesTotal(charges: Charge[], goods: UGX): UGX {
  return charges.reduce((s, ch) => s + chargeAmount(ch, goods), 0);
}

/**
 * The order total before credit: goods + charges − discount (the discount never past them).
 * spec 02 §2 "cash total" (sales.html:4579 cashTotal); §8 Q17 the discount rounded as the server does.
 * Kevin's rule for every app: order total = goods + charges (spec 02 Q14, 0172).
 */
export function cashTotal(o: Pick<Order, 'lines' | 'charges' | 'discount'>): UGX {
  const goods = goodsTotal(o.lines), gross = goods + chargesTotal(o.charges, goods);
  return gross - Math.min(Math.max(0, whole(o.discount)), gross);
}

/**
 * The credit charge: ONE "Credit charge" line, pct of the order, never folded into unit prices.
 * spec 02 §2 creditCharge (sales.html:4581, round(cash total × pct / 100)); FACTS §6 "Price rules"
 * and the lead's final ruling: 186,000 on credit at 3% → +5,580 → 191,580. The pct is the shop's
 * (presets.creditPct, ShopSettings.creditPct), written onto the order as credit.pct.
 */
export function creditCharge(o: Pick<Order, 'lines' | 'charges' | 'discount' | 'credit'>): UGX {
  const pct = o.credit ? Number(o.credit.pct) || 0 : 0;
  return pct > 0 ? whole(cashTotal(o) * pct / 100) : 0;
}

/** The label of that one line, everywhere. */
export const CREDIT_CHARGE = 'Credit charge';

/** The order total: cash total + credit charge, never below 0. spec 02 §2 quoteTotal; §8 Q2. */
export function orderTotal(o: Pick<Order, 'lines' | 'charges' | 'discount' | 'credit'>): UGX {
  return Math.max(0, cashTotal(o) + creditCharge(o));
}

/** How many lines still wait for a price ("1 price coming"). spec 02 §2 pricedView toConfirm. */
export function pricesComing(lines: Line[]): number {
  return lines.filter((l) => l.qty > 0 && l.state !== 'dropped' && !linePriced(l)).length;
}

/** The rows a bill shows besides its items, so the paper adds up (sales.html:4586 orderExtraRows). */
export function extraRows(o: Pick<Order, 'lines' | 'charges' | 'discount' | 'credit'>): { label: string; amount: UGX }[] {
  const goods = goodsTotal(o.lines), out: { label: string; amount: UGX }[] = [];
  o.charges.forEach((ch) => { const a = chargeAmount(ch, goods); if (a > 0) out.push({ label: ch.label || 'Charge', amount: a }); });
  const disc = Math.min(Math.max(0, whole(o.discount)), goods + chargesTotal(o.charges, goods));
  if (disc > 0) out.push({ label: 'Discount', amount: -disc });
  const cr = creditCharge(o);
  if (cr > 0) out.push({ label: CREDIT_CHARGE, amount: cr });
  return out;
}

/* ---------------- what is owed, paid over, change, deposit ---------------- */

/** Still to pay on one order: total less what was paid, never below 0. spec 02 §2 balanceDue / orderDue (sales.html:4594-4597). */
export function orderOwes(o: Pick<Order, 'lines' | 'charges' | 'discount' | 'credit' | 'paid'>): UGX {
  return Math.max(0, orderTotal(o) - whole(o.paid));
}

/**
 * Taking money from a customer who owes `owes` (customers.debt; below 0 is a deposit already held).
 * spec 02 §6 receive_payment (0169:103) and §8 Q11: what clears the debt is least(paid, max(owes, 0));
 * the rest is "over". Over must be settled as change (handed back: only what is owed is money in) or
 * a deposit (all of it kept: the balance goes below 0). With neither, the server refuses (OWOVR).
 */
export function payPlan(owes: UGX, amount: UGX): { toDebt: UGX; over: UGX } {
  const left = Math.max(0, whole(amount)), toDebt = Math.min(left, Math.max(0, whole(owes)));
  return { toDebt, over: left - toDebt };
}

/** What the payment records, by how the over is settled. spec 02 §6 (0165 p_over). */
export function settleOver(owes: UGX, amount: UGX, how: 'change' | 'deposit' | null): { moneyIn: UGX; change: UGX; deposit: UGX; refused: boolean } {
  const { toDebt, over } = payPlan(owes, amount);
  if (over <= 0) return { moneyIn: toDebt, change: 0, deposit: 0, refused: false };
  if (how === 'change') return { moneyIn: toDebt, change: over, deposit: 0, refused: false };
  if (how === 'deposit') return { moneyIn: toDebt + over, change: 0, deposit: over, refused: false };
  return { moneyIn: 0, change: 0, deposit: 0, refused: true };
}

/** Cash at the counter: what they gave less the total; negative is "short". sales.html ctChangeHTML (KC05 "Give change"). */
export function changeFor(total: UGX, given: UGX): UGX {
  return whole(given) - whole(total);
}

/* ---------------- the 21-day hold ---------------- */

/** Days from a to b (both Kampala days). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

/**
 * A customer's open bills, oldest first: walk the debt log, a charge opens, a payment clears the
 * charge it names first, then the oldest; keep what has more than 0.5 left. spec 02 §5.3 custOpenCharges (sales.html:7329).
 */
export function openCharges(c: Pick<Customer, 'debtLog'>): { day: Day; orderId: number | null; left: UGX }[] {
  const log = c.debtLog.slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id));
  const open: { day: Day; orderId: number | null; left: number }[] = [];
  let credit = 0;
  for (const e of log) {
    if (e.type === 'charge' || (e.type === 'opening' && e.amount > 0)) {
      let left = Math.abs(e.amount);
      const use = Math.min(credit, left); left -= use; credit -= use;
      open.push({ day: e.day, orderId: e.orderId, left });
      continue;
    }
    let pay = Math.abs(e.amount);
    const named = e.orderId != null ? open.find((o) => o.orderId === e.orderId && o.left > 0) : undefined;
    if (named) { const take = Math.min(pay, named.left); named.left -= take; pay -= take; }
    for (const o of open) { if (!(pay > 0)) break; const take = Math.min(pay, o.left); o.left -= take; pay -= take; }
    credit += pay;
  }
  return open.filter((o) => o.left > 0.5).map((o) => ({ day: o.day, orderId: o.orderId, left: whole(o.left) }));
}

/** The age in days of the oldest open bill (0 when none). spec 02 §5.3. */
export function oldestAge(c: Pick<Customer, 'debtLog' | 'owes'>, today: Day): number {
  if (!(c.owes > 0)) return 0;
  const open = openCharges(c);
  return open.length ? Math.max(0, daysBetween(open[0].day, today)) : 0;
}

/** The hold line, in days: presets.creditHold.days, 21 when unset. spec 02 §8 Q8 (sales.html:4445 holdDays). */
export const HOLD_DAYS = 21;

/** The day a bill reaches the hold (#0531, Fri 2 Oct → "hold Fri 23 Oct"). FACTS §3.1. */
export function holdDay(billDay: Day, holdDays: number = HOLD_DAYS): Day {
  const d = new Date(billDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + holdDays);
  return d.toISOString().slice(0, 10);
}

/** "Past 21 days" or "Under 21 days" (FACTS §7: never "late" for a bill). */
export function pastHold(billDay: Day, today: Day, holdDays: number = HOLD_DAYS): boolean {
  return daysBetween(billDay, today) > holdDays;
}

/**
 * Would a new order on credit wait in Checking for the Manager? spec 02 §5.4 (sales.html:4452 creditHoldFor;
 * server ow_gate_reason 0167, 0174): over the limit with it, owed past the hold, or no limit set on credit.
 */
export function creditHold(
  c: Pick<Customer, 'owes' | 'creditLimit' | 'debtLog'>,
  orderAmount: UGX,
  onCredit: boolean,
  today: Day,
  holdDays: number = HOLD_DAYS,
): { over: boolean; old: boolean; noLimit: boolean; age: number } | null {
  const limit = c.creditLimit && c.creditLimit > 0 ? c.creditLimit : 0;
  const withIt = Math.max(0, c.owes) + Math.max(0, orderAmount);
  const over = limit > 0 && withIt > limit;
  const age = c.owes > 0 ? oldestAge(c, today) : 0;
  const old = age > holdDays;
  const noLimit = !(limit > 0) && onCredit;
  return over || old || noLimit ? { over, old, noLimit, age } : null;
}
