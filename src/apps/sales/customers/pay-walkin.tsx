/*
 * CU34 · A walk-in pays part: "6,000 left · who owes it?". The likely ones
 * first (someone whose number shares the walk-in's, then today's most recent
 * customers), what it adds to their account with its Credit charge
 * (money.ts creditCharge: the shop's pct, one line, never in unit prices),
 * and where that leaves them against the Manager's limit.
 */
import type { JSX } from 'preact';
import { creditCharge, money } from '../../../core/money.ts';
import { phone9 } from '../../../core/names.ts';
import type { Books, Customer, Order } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { role } from './Customer.tsx';
import { first } from './cust-head.tsx';
import { short } from './data.ts';
import { WhoCard, type WhoOpt } from './pay-parts.tsx';

/** The rest on their account: the rest plus its Credit charge (one line, the shop's pct). */
export function shareFor(b: Books, left: number): { charge: number; share: number } {
  const charge = creditCharge({ lines: [], charges: [{ id: 0, label: '', type: 'fixed', value: left }], discount: 0, credit: { pct: b.settings.creditPct, days: 30 } });
  return { charge, share: left + charge };
}

/** Same first six digits after 0: the same company's phones (0772 418 905 → Kato's 0772 418 220). */
function samePlace(a: string, c: Customer): boolean {
  const x = phone9(a), y = phone9(c.phone);
  return !!x && !!y && x.slice(0, 5) === y.slice(0, 5);
}

export function whoOptions(b: Books, o: Order): Customer[] {
  const mine = b.customers.filter((c) => !c.qa);
  const lastAt = (c: Customer) => b.orders.filter((x) => x.customerId === c.id).reduce((m, x) => Math.max(m, x.placedAt), 0);
  const match = mine.filter((c) => o.client.phone && samePlace(o.client.phone, c));
  const recent = mine.filter((c) => !match.includes(c)).sort((x, y) => lastAt(y) - lastAt(x));
  return [...match, ...recent].slice(0, 2);
}

export function WalkinWho(p: { b: Books; o: Order; left: number; opts: Customer[]; chosen: string | null; onPick: (id: string) => void }): JSX.Element {
  const { b, o } = p, ruth = first(role(b, 'manager').name), { charge, share } = shareFor(b, p.left);
  const opts: WhoOpt[] = p.opts.map((c) => ({
    id: c.id, initials: c.initials, tint: c.tint, name: c.name, owes: c.owes,
    sub: o.client.phone && samePlace(o.client.phone, c) ? `${short(c.name)}’s worker · on his account` : c.creditLimit ? `credit ${money(c.creditLimit)} · ${ruth}` : `No limit set · ${ruth} decides`,
  }));
  const chosen = p.chosen ? b.customers.find((c) => c.id === p.chosen) || null : null;
  return (
    <WhoCard left={p.left} opts={opts} chosen={p.chosen} onPick={p.onPick} share={share} onFind={() => nav.push('customers', { pick: o.id })}
      credit={chosen ? { pct: b.settings.creditPct, charge, owes: chosen.owes, limit: chosen.creditLimit, label: `${short(chosen.name)} would owe ${money(chosen.owes + share)} of a ${money(chosen.creditLimit || 0)} limit` } : null} />
  );
}
