/*
 * The stock decisions' figures, once (docs/spec/04-screens-manager.md §4 D-13 … D-17, D-23, D-24;
 * DecideStock and Added p4 boards). Pure functions over the Manager's types: the Decide kinds
 * (src/apps/manager/decide/kinds/loss · carton · checkin · extra · count) and Orders · Stock
 * draw these and never work a figure out again. Every figure is at cost, whole shillings.
 */
import type { CartonAsk, CheckinAsk, CountAsk, ExtraAsk, LossReport, Ms, RestockLine, UGX } from './types.ts';

const SHORT = ['sht', 'pc', 'pcs', 'm', 'kg', 'l', 'ltr', 'g'];

/** "bag" → "bags"; a unit already plural, or written short (sht, pcs, kg), stays. */
export function units(n: number, unit: string): string {
  if (n === 1 || /s$/.test(unit) || SHORT.includes(unit)) return unit;
  return unit + 's';
}

/** "bags" → "bag": the one-word form ("34,000 a bag"). */
export function unitOne(unit: string): string {
  return SHORT.includes(unit) ? unit : unit.replace(/s$/, '');
}

/* ---------------- D-16 Damaged · Lost · Stolen ---------------- */

/** What the write-off takes off the books: the reports switched on, at cost. */
export function lossOff(reports: LossReport[], on: string[]): { qty: number; total: UGX; unit: string } {
  const rs = reports.filter((r) => on.includes(r.id));
  return {
    qty: rs.reduce((s, r) => s + r.qty, 0),
    total: rs.reduce((s, r) => s + Math.round(r.qty * r.cost), 0),
    unit: rs.length ? rs[0].unit : (reports[0] ? reports[0].unit : ''),
  };
}

/** One report: on the shelf now → after the write-off (when it is switched on). */
export function shelfAfter(r: LossReport, on: boolean): { now: number; after: number } {
  return { now: r.shelf, after: on ? Math.max(0, r.shelf - r.qty) : r.shelf };
}

/** The ids switched on, and those kept: `writeOff(on, off)`. */
export function lossSplit(reports: LossReport[], on: string[]): [string[], string[]] {
  return [reports.filter((r) => on.includes(r.id)).map((r) => r.id), reports.filter((r) => !on.includes(r.id)).map((r) => r.id)];
}

/* ---------------- D-24 A carton for the shelf? ---------------- */

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2026": a month, Kampala time, `add` months on. */
export function monthYear(at: Ms, add = 0): string {
  const d = new Date(at + 3 * 3600e3);
  const m = d.getUTCMonth() + add;
  return `${MONTH[((m % 12) + 12) % 12]} ${d.getUTCFullYear() + Math.floor(m / 12)}`;
}

/** The carton: what each answer buys, and how long the shelf part lasts at today's selling. */
export function carton(a: CartonAsk, now: Ms): {
  packs: number; shelf: UGX; order: UGX; whole: UGX; months: number; from: string; to: string;
} {
  const months = a.perMonth > 0 ? Math.round(a.forShelf / a.perMonth) : 0;
  return {
    packs: a.forOrder + a.forShelf,
    shelf: Math.round(a.forShelf * a.cost),
    order: Math.round(a.forOrder * a.cost),
    whole: Math.round((a.forOrder + a.forShelf) * a.cost),
    months,
    from: monthYear(now),
    to: monthYear(now, months),
  };
}

/* ---------------- D-13 + D-14 the check-in differs ---------------- */

export interface CheckinRow { name: string; unit: string; brought: number; counted: number; diff: number; value: UGX; cost: UGX; place: string }

/** Line by line, the runner's against the Store's count; the difference at cost. */
export function checkin(a: CheckinAsk): { rows: CheckinRow[]; differ: number; total: UGX } {
  const rows = a.lines.map((l) => ({ ...l, diff: l.counted - l.brought, value: Math.round((l.counted - l.brought) * l.cost) }));
  return { rows, differ: rows.filter((r) => r.diff !== 0).length, total: rows.reduce((s, r) => s + r.value, 0) };
}

/* ---------------- D-15 not on the list ---------------- */

/** What keeping the extra puts on the shelf, at cost (null: the cost is not known). */
export function extraValue(a: ExtraAsk): UGX | null {
  return a.cost == null ? null : Math.round(a.qty * a.cost);
}

/* ---------------- D-17 a count to check ---------------- */

export interface CountRow { key: string; name: string; system: number; counted: number; value: UGX }

/** The count: each line's difference at cost, the ones that differ, the net. */
export function count(a: CountAsk): { rows: CountRow[]; differ: CountRow[]; net: UGX } {
  const rows = a.lines.map((l) => ({ key: l.key, name: l.name, system: l.system, counted: l.counted, value: Math.round((l.counted - l.system) * l.cost) }));
  const differ = rows.filter((r) => r.counted !== r.system);
  return { rows, differ, net: differ.reduce((s, r) => s + r.value, 0) };
}

/* ---------------- D-23 Denis's restock list ---------------- */

export const WEEKS_OF = 8;

/** A line's weeks left as the row's bar tone: 2 or less red, 3 amber, more green. */
export function weeksTone(w: number | null): 'bad' | 'warn' | 'good' {
  if (w == null) return 'good';
  return w <= 2 ? 'bad' : w <= 3 ? 'warn' : 'good';
}

export function restockValue(r: RestockLine): UGX {
  return Math.round(r.qty * r.cost);
}

/** The trip: planned (shortest first), held (Not yet), and the money each way. */
export function restockPlan(lines: RestockLine[]): { planned: RestockLine[]; held: RestockLine[]; total: UGX; ahead: UGX; notYet: UGX } {
  const left = (r: RestockLine) => (r.weeksLeft == null ? Infinity : r.weeksLeft);
  const planned = lines.filter((r) => !r.held).sort((a, b) => left(a) - left(b));
  const held = lines.filter((r) => r.held);
  const sum = (xs: RestockLine[]) => xs.reduce((s, r) => s + restockValue(r), 0);
  return { planned, held, total: sum(lines), ahead: sum(planned), notYet: sum(held) };
}
