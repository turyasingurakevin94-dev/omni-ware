/*
 * The money figures the Decide sheet's price and credit kinds draw that price.ts and credit.ts
 * do not already give (DecidePrice, MoneyCredit). One rule each; plain numbers in, plain out,
 * so a test imports them as they are.
 */
import type { Cust, MLine, MOrder, Promise_, UGX } from './types.ts';

/** "A sheet", "A bag", "A piece": one of a line's unit, as the scale card heads it. */
export function oneUnit(unit: string): string {
  const u = unit.toLowerCase();
  const w = u === 'sht' || u === 'sheet' || u === 'sheets' ? 'sheet'
    : u === 'pcs' || u === 'pc' || u === 'piece' || u === 'pieces' ? 'piece'
    : u === 'bags' ? 'bag'
    : u === 'packs' ? 'pack'
    : u;
  return `A ${w}`;
}

/** The two marks either side of the shop's price on the scale (D-2, D-33): its markup 5 points lower and higher. */
export function markupTicks(cost: UGX, markup: number): [UGX, UGX] {
  return [Math.round(cost * (1 + markup - 0.05)), Math.round(cost * (1 + markup + 0.05))];
}

/** "34–36k": what the rivals sell it at (D-33). */
export function rivalsWord(r: [UGX, UGX]): string {
  const k = (n: UGX) => { const v = n / 1000; return Number.isInteger(v) ? String(v) : v.toFixed(1); };
  return `${k(r[0])}–${k(r[1])}k`;
}

/** The figure a line's dock adds up and its gain, at a price (D-1 … D-4). */
export function lineAt(l: Pick<MLine, 'qty' | 'cost'>, price: UGX): { total: UGX; gain: UGX | null } {
  return { total: Math.round(price * l.qty), gain: l.cost != null ? Math.round((price - l.cost) * l.qty) : null };
}

/** The credit gauge's full width: 1.2 × the largest figure on it, up to the next half million. */
export function gaugeMax(figures: (UGX | null | undefined)[]): UGX {
  const m = Math.max(1, ...figures.filter((x): x is UGX => x != null));
  return Math.ceil((m * 1.2) / 500_000) * 500_000;
}

/** Where a figure sits on the gauge, 0–100. */
export function gaugePct(v: UGX, max: UGX): number {
  return Math.max(0, Math.min(100, (v / max) * 100));
}

/** D-5's hold track: days from 0 to a little past the oldest bill (40 at least), the hold line, each open bill's age. */
export function holdTrack(ages: number[], holdDays: number): { max: number; hold: number; dots: number[] } {
  const oldest = Math.max(0, ...ages);
  const max = Math.max(40, oldest + 2, holdDays + 5);
  return { max, hold: (holdDays / max) * 100, dots: ages.map((d) => (Math.min(d, max) / max) * 100) };
}

/** "1 kept", "2 broken": the customer's promises, by how they went (open ones left out). */
export function promiseCounts(ps: Pick<Promise_, 'state'>[]): { kept: number; broken: number } {
  return { kept: ps.filter((p) => p.state === 'kept').length, broken: ps.filter((p) => p.state === 'broken').length };
}

/** D-7's chips about the customer: Owes 0 · 1st order on credit · Cash customer. */
export function creditFacts(c: Pick<Cust, 'owes' | 'bills' | 'limit'>): { text: string; tone: 'good' | 'soft' }[] {
  const out: { text: string; tone: 'good' | 'soft' }[] = [];
  if (c.owes <= 0) out.push({ text: 'Owes 0', tone: 'good' });
  if (!c.bills.length) out.push({ text: '1st order on credit', tone: 'soft' });
  if (!c.limit) out.push({ text: 'Cash customer', tone: 'soft' });
  return out;
}

/** D-7's truck clock: minutes it has waited since the Store asked, and the ring's fill (of an hour). */
export function truckWait(askedAt: number, now: number): { mins: number; fill: number } {
  const mins = Math.max(0, Math.round((now - askedAt) / 60000));
  return { mins, fill: Math.min(1, mins / 60) };
}

/** D-32's terms line: "14 days · same", "30 days · was 14". */
export function termsWord(asked: number, own: number | null): string {
  return `${asked} days · ${own == null ? 'new' : own === asked ? 'same' : `was ${own}`}`;
}

/** What is still to pay on an order (the would-owe hatch). */
export function orderLeft(o: Pick<MOrder, 'total' | 'paid'>): UGX {
  return Math.max(0, o.total - o.paid);
}
