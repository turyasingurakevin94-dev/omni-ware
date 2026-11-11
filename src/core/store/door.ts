/*
 * On the road, the door and the road back (docs/spec/04-screens-store.md §4.4; OU20–OU28, OU24, OU27):
 * the shutter takes the photo and marks it Delivered; with no photo, one reason; a drop that cannot be
 * delivered comes back to the gate.
 *
 *   onTheRoad(b)           the drivers out now, each with his stops in the order they were loaded (OU20)
 *   bringBack(o)           cancelled on the truck, or coming back
 *   noPhotoWhy(o)          the four reasons (store.html:4986), the first in the customer's name (OU23)
 *   CANT_WHY               Closed · Nobody there · Refused · Wrong place (OU24)
 *   aisleLetter(b, key)    "C": the item's aisle letter, A–L in the shop's order
 *   offTheTruck(o)         the lines that come off (or back); dropped lines left out
 *   billAt(o)              the bill goes by itself 24 h after it was delivered
 *   receiver(o)            who takes it at the door ("Kato's site manager")
 */
import { aisleLetter as letterOfAisle } from './counts.ts';
import { firstWord } from '../names.ts';
import type { Ms } from '../types.ts';
import type { YardBooks, YardLine, YardOrder } from './types.ts';
import { destinationOf, isCancelled, onATruck } from './yard.ts';

export const DAY_MS = 864e5;

export function noPhotoWhy(o: YardOrder): string[] {
  return [`${firstWord(o.client.name)} said no photo`, 'The camera won’t open', 'Too dark to see', 'Phone battery low'];
}

export const CANT_WHY = ['Closed', 'Nobody there', 'Refused', 'Wrong place'] as const;

export const aisleOf = (b: YardBooks, key: string): string | null => {
  const it = b.items.find((x) => x.key === key);
  return it ? it.category : null;
};

/** An item's aisle letter, by its key (counts.ts aisleLetter); null: no aisle yet. */
export const aisleLetter = (b: YardBooks, key: string): string | null => letterOfAisle(b, aisleOf(b, key)) || null;

export const offTheTruck = (o: YardOrder): YardLine[] => o.lines.filter((l) => !l.dropped);

/** The line's quantity as it went on the truck. */
export const lineQty = (l: YardLine): number => l.pickedQty ?? l.qty;

export const billAt = (o: YardOrder): Ms | null => (o.deliveredAt != null ? o.deliveredAt + DAY_MS : null);

/** Who receives it: whoever took it, else the customer's site manager on a site, else the customer. */
export function receiver(o: YardOrder): string {
  if (o.deliveredTo) return o.deliveredTo;
  return /\bsite\b/i.test(o.deliverTo || '') ? `${firstWord(o.client.name)}’s site manager` : o.client.name;
}

export interface Run { driver: string; staffId: string | null; hired: boolean; left: Ms | null; dueBack: Ms | null; stops: YardOrder[] }

/** The drivers out now (pickups are the gate's), each with his stops in the order they were loaded. */
export function onTheRoad(b: YardBooks): Run[] {
  const runs = new Map<string, Run>();
  b.orders.filter((o) => onATruck(o) && !!o.carrier && o.carrier.kind !== 'client' && o.carrier.kind !== 'agent').forEach((o) => {
    const c = o.carrier!, k = c.staffId || c.name;
    const r = runs.get(k) || { driver: c.name, staffId: c.staffId, hired: c.kind === 'hired', left: c.at, dueBack: c.dueBack ?? null, stops: [] };
    r.stops.push(o);
    runs.set(k, r);
  });
  return [...runs.values()].map((r) => ({ ...r, stops: r.stops.sort((x, y) => x.id - y.id) }));
}

/** A stop that will not be delivered: cancelled on the truck, or coming back. */
export const bringBack = (o: YardOrder): boolean => isCancelled(o) || !!o.comingBack;

/** "Ntinda", "Ggaba": the drop's first words. */
export const placeWord = (o: YardOrder, b: YardBooks): string => (destinationOf(o, b.customers) || '').split(',')[0].trim();
