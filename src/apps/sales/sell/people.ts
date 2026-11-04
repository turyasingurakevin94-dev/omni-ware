/*
 * The shop's people a Sell screen names (decision-rights: the Manager decides prices and credit,
 * Sourcing finds the cost of a "Price coming" line, the Buyer buys what is ordered in, the Store packs).
 * Always the person's display name, never the role.
 */
import { firstWord } from '../../../core/names.ts';
import type { Books, Member, Role } from '../../../core/types.ts';

export interface Who { id: string; name: string; first: string; initials: string; tint: Member['tint'] }

function one(b: Books, roles: Role[], fallback: string): Who {
  const m = b.members.find((x) => roles.includes(x.role) && x.presence !== null) || b.members.find((x) => roles.includes(x.role));
  return m ? { id: m.id, name: m.name, first: firstWord(m.name), initials: m.initials, tint: m.tint } : { id: '', name: fallback, first: fallback, initials: fallback.slice(0, 2).toUpperCase(), tint: 't4' };
}

/** Ruth: prices under the shop's, credit (decision-rights). */
export const manager = (b: Books) => one(b, ['manager'], 'The Manager');
/** Moses: finds items and their cost. */
export const sourcing = (b: Books) => one(b, ['sourcing'], 'Sourcing');
/** Denis: buys what is ordered in. */
export const buyer = (b: Books) => one(b, ['buyer'], 'The Buyer');
/** Musa: packs. */
export const store = (b: Books) => one(b, ['store'], 'The Store');
