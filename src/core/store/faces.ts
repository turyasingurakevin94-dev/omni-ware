/*
 * Faces on the yard's phone (FACTS §1 tints; WORD-05 "who, with a face"): a person's, an order's
 * customer's, a supplier's. One rule, so a face is the same colour on every Store screen.
 *
 *   personFace(p)       their initials and tint (Grace navy, Ruth teal, Denis indigo … as the canvas casts them)
 *   yardFace(b, p)      the same, but the phone's holder slate (FACTS "MK slate"): every face off Today's hero
 *   whoIs(b, idOrUser)  the person by staff id or login id
 *   orderFace(o, b)     the customer's (Kato KC, Kyaligonza KS, …); a walk-in is "WI"
 *   supplierFace(name)  a supplier's, slate ("HC" Hima Cement)
 *   customerFace(o, b)  who the order is for, with the name: the customer's face, or an agent's for an agent pickup (PK07)
 */
import { initials, tintFor } from '../names.ts';
import type { Tint } from '../types.ts';
import type { YardBooks, YardOrder, YardPerson } from './types.ts';

export interface YardFace { initials: string; tint: Tint }

export const personFace = (p: Pick<YardPerson, 'initials' | 'tint'> | null | undefined): YardFace => (p ? { initials: p.initials, tint: p.tint } : { initials: '?', tint: 't4' });

/** A person on a light ground or in a list: the holder slate ("Me" is a chip, not a badge), the rest their tint (Grace navy). */
export function yardFace(b: Pick<YardBooks, 'me'>, p: Pick<YardPerson, 'id' | 'initials' | 'tint'> | null | undefined): YardFace {
  return p && p.id === b.me.id ? { initials: p.initials, tint: 't4' } : personFace(p);
}

export function whoIs(b: Pick<YardBooks, 'people'>, id: string | null | undefined): YardPerson | null {
  if (!id) return null;
  return b.people.find((p) => p.id === id || p.userId === id) || null;
}

export function orderFace(o: Pick<YardOrder, 'client' | 'customerId'>, b: Pick<YardBooks, 'customers'>): YardFace {
  const c = b.customers.find((x) => x.id === o.customerId);
  const name = (c ? c.name : o.client.name) || 'Walk-in';
  if (!c && /^walk-?in/i.test(name)) return { initials: 'WI', tint: 't4' };
  return { initials: initials(name), tint: (c && c.tint) || tintFor(name) };
}

export const supplierFace = (name: string): YardFace => ({ initials: initials(name), tint: 't4' });

/** The customer's short name, as the yard says it ("Kyaligonza" for Kyaligonza & Sons, "Kato" for Kato Construction; a walk-in "Walk-in"). */
export function shortName(o: Pick<YardOrder, 'client'>): string {
  const n = (o.client.name || '').trim();
  return !n || /^walk-?\s?in$/i.test(n) ? 'Walk-in' : n.split(/\s+/)[0];
}

/** Who the order is for, with the name (the Pack screens' heads and rows): an agent pickup is the agent's (PK07), else orderFace. */
export function customerFace(o: YardOrder, b: Pick<YardBooks, 'customers' | 'agents'>): YardFace & { name: string } {
  const ag = o.originAgentId ? b.agents.find((a) => a.id === o.originAgentId) : null;
  if (ag) return { name: ag.name, initials: initials(ag.name), tint: ag.tint || tintFor(ag.name) };
  const c = b.customers.find((x) => x.id === o.customerId);
  return { name: (c && c.name) || o.client.name || 'Walk-in', ...orderFace(o, b) };
}
