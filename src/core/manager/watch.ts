/*
 * Watching the shop (spec 04-screens-manager §6): stuck orders, twins, the bill
 * that bills itself, the team's pace, who owes by age. Nobody asks for these;
 * the app spots them. One rule each.
 */
import { addDays, dayOf, daysApart, daysLeftInMonth } from '../time.ts';
import type { Cust, Day, ManagerBooks, MOrder, Ms, Person, Shop, Stage, UGX } from './types.ts';
import { oldestDays } from './credit.ts';

/** The suggested stage limits in minutes (manager.html:1639), used until the shop sets its own. */
export const SUGGESTED_LIMITS: Partial<Record<Stage, number>> = { draft: 120, awaiting_goods: 1440, preparing: 120, pending_delivery: 240 };

export function limitsOf(s: Pick<Shop, 'stageLimits'>): Partial<Record<Stage, number>> {
  const own = Object.values(s.stageLimits).some((v) => Number(v) > 0);
  return own ? s.stageLimits : SUGGESTED_LIMITS;
}

/** Minutes in its stage now. */
export function stageMins(o: Pick<MOrder, 'stageAt'>, now: Ms): number {
  return Math.max(0, (now - o.stageAt) / 60000);
}

/** Live: not delivered, not cancelled. */
export function onTheMove(b: Pick<ManagerBooks, 'orders'>): MOrder[] {
  return b.orders.filter((o) => o.stage !== 'completed' && o.stage !== 'cancelled');
}

/** Stuck: longer in its stage than the stage's limit. Oldest first. */
export function stuck(b: Pick<ManagerBooks, 'orders' | 'shop'>, now: Ms): { o: MOrder; mins: number; limit: number; over: number }[] {
  const lim = limitsOf(b.shop);
  return onTheMove(b)
    .map((o) => ({ o, mins: stageMins(o, now), limit: Number(lim[o.stage]) || 0 }))
    .filter((x) => x.limit > 0 && x.mins > x.limit)
    .map((x) => ({ ...x, over: x.mins - x.limit }))
    .sort((x, y) => x.o.stageAt - y.o.stageAt);
}

/** Taken twice? (manager.html:3580–3600): two orders of one customer within 4 h, same lines or same total. */
export const TWIN_HOURS = 4;
function sig(o: MOrder): string {
  return o.lines.map((l) => `${l.name}:${l.qty}`).sort().join('|');
}
export function twins(b: Pick<ManagerBooks, 'orders'>): { keep: MOrder; drop: MOrder; same: boolean }[] {
  const by = new Map<string, MOrder[]>();
  b.orders.filter((o) => o.stage !== 'cancelled' && o.customerId).forEach((o) => {
    const k = o.customerId as string;
    by.set(k, [...(by.get(k) || []), o]);
  });
  const out: { keep: MOrder; drop: MOrder; same: boolean }[] = [];
  by.forEach((list) => {
    list.sort((x, y) => x.createdAt - y.createdAt);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], c = list[j];
        if (c.createdAt - a.createdAt > TWIN_HOURS * 3600e3) break;
        if (a.twinOk.includes(c.id) || c.twinOk.includes(a.id)) continue;
        const same = sig(a) !== '' && sig(a) === sig(c);
        if (same || (a.total > 0 && a.total === c.total)) out.push({ keep: a, drop: c, same });
      }
    }
  });
  return out;
}

/** Bills itself 24 h after delivery: ms left, or 0 when due. */
export const BILL_AFTER_MS = 24 * 3600e3;
export function billsIn(o: Pick<MOrder, 'deliveredAt'>, now: Ms): number {
  return o.deliveredAt == null ? 0 : Math.max(0, o.deliveredAt + BILL_AFTER_MS - now);
}

/**
 * Delivered, not yet billed, not held: they bill themselves (Orders → To bill). An order that may be
 * a twin waits on Ruth instead (Taken twice?), so it is never counted twice.
 */
export function toBillThemselves(b: Pick<ManagerBooks, 'orders'>): MOrder[] {
  const twin = new Set(twins(b).map((x) => x.drop.id));
  return b.orders.filter((o) => o.stage === 'completed' && !o.invoiced && !o.heldCode && !twin.has(o.id)).sort((x, y) => (x.deliveredAt || 0) - (y.deliveredAt || 0));
}

/** "in 6 h 05 m". */
export function inWords(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return `in ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}

/**
 * The month's pace: today counts as a day sold (day 17 of 31 on Sat 17 Oct → 0.548). The boards drew
 * "day 17.6 of 31" (0.5667, which is 17 of 30); no clock gives that, so the app uses the rule (spec §7 Q6).
 */
export function pace(now: Ms): { day: number; of: number; frac: number; daysLeft: number } {
  const today = dayOf(now);
  const first = today.slice(0, 8) + '01';
  const of = daysApart(first, addDays(first, 32).slice(0, 8) + '01');
  const day = daysApart(first, today) + 1;
  return { day, of, frac: day / of, daysLeft: daysLeftInMonth(today) };
}

/** Ahead (+) or behind (−) of pace on a goal; what is needed a day for the rest. */
export function onPace(sold: UGX, goal: UGX | null, now: Ms): { ahead: UGX; perDay: UGX; pct: number; pacePct: number } {
  const p = pace(now);
  const g = goal || 0;
  const days = Math.max(1, p.of - p.day);
  return {
    ahead: Math.round(sold - g * p.frac),
    perDay: g ? Math.max(0, Math.round((g - sold) / days)) : 0,
    pct: g ? sold / g : 0,
    pacePct: p.frac,
  };
}

/** The salespeople, furthest behind first. */
export function behind(team: Person[], now: Ms): { p: Person; ahead: UGX }[] {
  return team.filter((p) => p.role === 'sales' && p.goal).map((p) => ({ p, ahead: onPace(p.sold, p.goal, now).ahead })).sort((x, y) => x.ahead - y.ahead);
}

/** The age bands of what is owed, by the oldest unpaid bill (Money p1). */
export const BANDS = [
  { key: 'u7', label: 'under 7 d', max: 7 },
  { key: 'u21', label: '8–21 d', max: 21 },
  { key: 'u30', label: '22–30 d', max: 30 },
  { key: 'o30', label: 'over 30 d', max: Infinity },
] as const;
export type BandKey = (typeof BANDS)[number]['key'];

export function bandOf(days: number): BandKey {
  return (BANDS.find((b) => days <= b.max) || BANDS[3]).key;
}

export function debtors(b: Pick<ManagerBooks, 'customers'>, today: Day): { c: Cust; days: number; band: BandKey }[] {
  return b.customers.filter((c) => !c.qa && c.owes > 0)
    .map((c) => { const days = oldestDays(c, today); return { c, days, band: bandOf(days) }; })
    .sort((x, y) => y.days - x.days || y.c.owes - x.c.owes);
}

export function bands(b: Pick<ManagerBooks, 'customers'>, today: Day): Record<BandKey, UGX> {
  const out: Record<BandKey, UGX> = { u7: 0, u21: 0, u30: 0, o30: 0 };
  debtors(b, today).forEach((d) => { out[d.band] += d.c.owes; });
  return out;
}
