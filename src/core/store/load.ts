/*
 * To load, by direction (docs/spec/04-screens-store.md §4.4; OU01, OU02, OU03, OU20, OU31).
 * Plain functions over the yard's books and its places (YardSide); no screen works these out itself.
 *
 *   directions(b, side, me, now)   packed deliveries grouped by compass sector from the yard (45°), each
 *                                  named once by its farthest place; nearest direction first, last drop first
 *   driversOf(b, run)              Ssali · Hassan · Hired · Me, the run's driver chosen (OU02 "Who drives")
 *   trucks(b)                      each driver of ours: out (back ~12:10) or in the yard (OU01 "Trucks")
 *   pastHired(b)                   the last 8 hired drivers by their phone (OU03)
 *   hiredPhoneOk(p)                a Ugandan mobile, 256 7/3 + 8 digits (store.html:4783)
 *   packWords(qty, unit, …)        "40 pc · 2 bundles"
 *
 * Sources: store.html:2845 drivers, 2846 sectorOf, 4424 pastHired, 4430 defaultCarrier, 4436 loadDrops,
 * 4444 roadsOf, 4783 phoneOk.
 */
import type { Ms } from '../types.ts';
import type { Carrier, YardBooks, YardOrder, YardPerson, YardSide } from './types.ts';
import { destinationOf, isPickup, moneyHeld, ordersAt } from './yard.ts';

type Place = YardSide['places'][number];

export const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

const rad = (d: number) => (d * Math.PI) / 180;

/** Degrees from north, clockwise, from a to b. */
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** As the crow flies, km. */
export function crowKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The yard's own pin: the place named as the shop, else the first. */
export function yardPin(side: YardSide | null, shopName: string): Place | null {
  if (!side || !side.places.length) return null;
  return side.places.find((p) => p.name.toLowerCase() === shopName.toLowerCase()) || side.places[0];
}

/** The known place a drop goes to: the longest place name its destination names ("Ntinda site, Plot 12" → Ntinda). */
export function placeOf(dest: string, side: YardSide | null, yard: Place | null): Place | null {
  if (!side) return null;
  const d = dest.toLowerCase();
  return side.places.filter((p) => p !== yard && d.includes(p.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0] || null;
}

/** "Ntinda site, Plot 12, Ntinda Rd" → "Ntinda site": the drop's first words, for a row. */
export const dropShort = (dest: string): string => dest.split(',')[0].trim();

export interface Drop { o: YardOrder; dest: string; place: string; km: number | null; sector: number | null }

export interface Direction {
  /** The farthest place, lower case: the run's key (out/run { dir }) and road_names' key. */
  key: string;
  /** "→ Ntinda" when named, "→ Bweyogerere way" when not (OU01). */
  name: string;
  named: boolean;
  /** The compass word, "east" (OU31 "East of the yard"). */
  compass: string | null;
  sector: number | null;
  /** Last drop first: the farthest goes on the truck first. */
  drops: Drop[];
  /** When the run leaves (the first drop's), if known. */
  leavesAt: Ms | null;
}

/** The drops on the yard's map: packed deliveries (not pickups), with where they go. */
export function dropsOf(b: YardBooks, side: YardSide | null, me: string | null, now: Ms): Drop[] {
  const yard = yardPin(side, b.shopName);
  return ordersAt(b, 'packed', me, now).filter((o) => !isPickup(o, b.customers)).map((o) => {
    const dest = destinationOf(o, b.customers) || '';
    const pin = placeOf(dest, side, yard);
    return { o, dest, place: pin ? pin.name : dropShort(dest), km: pin && yard ? crowKm(yard, pin) : null, sector: pin && yard ? Math.round(bearing(yard, pin) / 45) % 8 : null };
  });
}

/** Packed deliveries grouped by direction; nearest direction first (store.html:4444 roadsOf). */
export function directions(b: YardBooks, side: YardSide | null, me: string | null, now: Ms): Direction[] {
  const g = new Map<string, Drop[]>();
  dropsOf(b, side, me, now).forEach((d) => {
    const k = d.sector != null ? 's' + d.sector : 'p' + d.place.toLowerCase();
    g.set(k, [...(g.get(k) || []), d]);
  });
  const names = (side && side.roadNames) || {};
  return [...g.values()].map((ds) => {
    const drops = ds.slice().sort((x, y) => (y.km ?? 0) - (x.km ?? 0));
    const far = drops[0], key = far.place.toLowerCase(), named = names[key];
    const leaves = drops.map((d) => d.o.leavesAt ?? null).filter((x): x is Ms => x != null).sort((x, y) => x - y)[0] ?? null;
    return { key, name: named ? `→ ${named}` : `→ ${far.place} way`, named: !!named, compass: far.sector != null ? COMPASS[far.sector] : null, sector: far.sector, drops, leavesAt: leaves };
  }).sort((x, y) => (x.drops[0].km ?? 99) - (y.drops[0].km ?? 99));
}

/** The run of one direction (out/run { dir }), or null when it has gone. */
export function runOf(b: YardBooks, side: YardSide | null, me: string | null, now: Ms, dir: string): Direction | null {
  return directions(b, side, me, now).find((d) => d.key === dir) || null;
}

/** Nothing on this run can leave: every drop is Not paid yet (OU01 "Nothing can leave yet"). */
export const runHeld = (d: Direction): boolean => d.drops.every((x) => moneyHeld(x.o));

/** Our drivers (store.html:4423 staffDrivers): not away, a driver first. */
export function staffDrivers(b: YardBooks): YardPerson[] {
  return b.people.filter((p) => !p.away && p.role === 'driver');
}

/** A driver's order on a truck now, if he is out. */
const outWith = (b: YardBooks, id: string): YardOrder | undefined =>
  b.orders.find((o) => o.status === 'pending_delivery' && !o.deliveredAt && o.carrier && o.carrier.kind === 'staff' && o.carrier.staffId === id);

export interface Truck { p: YardPerson; out: boolean; dueBack: Ms | null }

/** Each driver of ours, out or in the yard (OU01 "Trucks · 1 in the yard"). */
export function trucks(b: YardBooks): Truck[] {
  return staffDrivers(b).map((p) => {
    const o = outWith(b, p.id);
    return { p, out: !!o, dueBack: o && o.carrier ? o.carrier.dueBack ?? null : null };
  });
}

/** The last staff carrier who took a drop to this place ("Ssali drove Ntinda last"). */
export function droveLast(b: YardBooks, place: string): Carrier | null {
  const p = place.toLowerCase();
  const hit = b.orders.filter((o) => o.carrier && o.carrier.kind === 'staff' && (destinationOf(o, b.customers) || '').toLowerCase().includes(p))
    .sort((x, y) => ((y.carrier as Carrier).at ?? 0) - ((x.carrier as Carrier).at ?? 0))[0];
  return hit ? hit.carrier : null;
}

/**
 * Who drives, remembered (store.html:4430 defaultCarrier): the run's planned driver, else whoever drove
 * this way last, else today's last driver of ours, else the first driver. A driver out now is offered
 * only when he is the one planned for this run (he is back before it leaves, OU01).
 */
export function driverOf(b: YardBooks, run: Direction | null): string | null {
  const planned = run ? run.drops.map((d) => d.o.runDriver).find((x) => !!x) : null;
  if (planned) return planned;
  const last = run ? droveLast(b, run.drops[0].place) : null;
  const free = staffDrivers(b).filter((p) => !outWith(b, p.id));
  if (last && last.staffId && free.some((p) => p.id === last.staffId)) return last.staffId;
  return free[0] ? free[0].id : null;
}

/** The drivers offered: ours not out (and the planned one), then Hired and Me (OU02's chips). */
export function driversOf(b: YardBooks, run: Direction | null): YardPerson[] {
  const planned = driverOf(b, run);
  return staffDrivers(b).filter((p) => p.id === planned || !outWith(b, p.id));
}

export interface Hired { name: string; phone: string; what: string; place: string; at: Ms | null; loads: number }

const digits = (p: string): string => String(p || '').replace(/[^0-9]/g, '');

/** The last 8 hired drivers, by their phone (store.html:4424 pastHired), newest first. */
export function pastHired(b: YardBooks, side: YardSide | null = null): Hired[] {
  const m = new Map<string, Hired>(), yard = yardPin(side, b.shopName);
  b.orders.forEach((o) => {
    const c = o.carrier;
    if (!c || c.kind !== 'hired' || !c.name) return;
    const k = digits(c.phone).slice(-9) || c.name.toLowerCase();
    const e = m.get(k) || { name: c.name, phone: c.phone, what: c.what, place: '', at: null, loads: 0 };
    e.loads++;
    if ((c.at ?? 0) >= (e.at ?? 0)) { e.at = c.at; e.what = c.what || e.what; e.phone = c.phone || e.phone; const dest = destinationOf(o, b.customers) || '', pin = placeOf(dest, side, yard); e.place = pin ? pin.name : dropShort(dest); }
    m.set(k, e);
  });
  return [...m.values()].sort((x, y) => (y.at ?? 0) - (x.at ?? 0)).slice(0, 8);
}

/** A hired driver's phone must be a Ugandan mobile: 07/03 or 2567/2563 and 8 more digits (store.html:4783). */
export function hiredPhoneOk(p: string): boolean {
  const d = digits(p);
  return /^0[73]\d{8}$/.test(d) || /^256[73]\d{8}$/.test(d);
}

/** "40 pc · 2 bundles": the line's unit, and whole packs when it has them. */
export function packWords(qty: number, unit: string, packQty: number, packUnit: string): string {
  if (!packUnit || packQty <= 1 || qty % packQty) return unit;
  const n = qty / packQty;
  return `${unit} · ${n} ${packUnit}${n === 1 ? '' : 's'}`;
}

/** The roads that way, for naming a direction (OU31): the places in its sector, the farthest first. */
export function roadsThatWay(side: YardSide | null, shopName: string, d: Direction): string[] {
  const yard = yardPin(side, shopName);
  if (!side || !yard || d.sector == null) return d.drops.map((x) => x.place);
  return side.places.filter((p) => p !== yard && Math.round(bearing(yard, p) / 45) % 8 === d.sector)
    .sort((x, y) => crowKm(yard, y) - crowKm(yard, x)).map((p) => p.name);
}

/**
 * Minutes to a drop: the road's own time when it is locked (place_routes), else the crow's km at Kampala's
 * daytime pace, about 8 km an hour ("arrives ~14:04", OU05).
 */
export function etaMins(side: YardSide | null, shopName: string, place: string): number | null {
  const r = side ? side.routes.find((x) => x.to.toLowerCase() === place.toLowerCase()) : null;
  if (r) return r.mins;
  const yard = yardPin(side, shopName), pin = side ? side.places.find((p) => p.name.toLowerCase() === place.toLowerCase()) : null;
  return yard && pin ? Math.round((crowKm(yard, pin) / 8) * 60) : null;
}

/** The order's own track (P18): when it entered Checking, Buying and Packing, and which it skipped. */
export function trackTimes(o: YardOrder): { checking: Ms | null; buying: Ms | null; packing: Ms | null; skipped: ('buying' | 'packing')[] } {
  const log = (s: string) => o.stageLog.find((x) => x.status === s)?.at ?? null;
  const buying = log('awaiting_goods');
  const bought = o.lines.some((l) => !!l.supplierId && l.supplierId !== '__stock__');
  const skipped: ('buying' | 'packing')[] = [];
  if (buying == null && !bought) skipped.push('buying');
  if (o.pickingAssignedAt == null && o.pickingStatus === 'done' && buying == null && !bought) skipped.push('packing');
  return { checking: o.createdAt ?? log('draft'), buying, packing: o.pickingAssignedAt ?? null, skipped };
}
