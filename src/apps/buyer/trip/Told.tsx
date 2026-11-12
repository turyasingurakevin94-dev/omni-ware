/*
 * Who the hand-in tells (TripHandIn.dc.html, Telling / Then told): the
 * Store counts it in, each salesperson whose line came short, Accounts
 * takes the cash back. live: going now (a ring each); kept: waits for signal;
 * else told (a tick each).
 */
import type { JSX } from 'preact';
import type { BLine, BOrder, BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { byRole, memberOf } from './model.ts';
import './handin.css';

export interface ToldProps {
  b: BuyerBooks;
  back: number;
  orders: number;
  shorts: { order: BOrder; line: BLine; got: number }[];
  live?: boolean;
  kept?: boolean;
}

interface Row { who: Member; what: string; warn?: boolean }

export function toldRows(p: ToldProps): Row[] {
  const out: Row[] = [];
  const musa = byRole(p.b, 'store'), esther = byRole(p.b, 'accounts');
  if (musa) out.push({ who: musa, what: `Count it in · ${counted(p.orders, 'order')}` });
  const seen = new Set<string>();
  p.shorts.forEach((s) => {
    const m = memberOf(p.b, s.order.sellerId);
    if (!m || seen.has(m.id)) return;
    seen.add(m.id);
    out.push({ who: m, what: `Short · got ${s.got} of ${s.line.qty} · ${orderNo(s.order.id)}`, warn: true });
  });
  if (esther) out.push({ who: esther, what: `Cash back ${fig(p.back)}` });
  return out;
}

export function Told(p: ToldProps): JSX.Element {
  const rows = toldRows(p);
  return (
    <div class="ow-b-hi-told" role={p.live ? 'status' : undefined}>
      {rows.map((r) => (
        <div key={r.who.id} class="ow-b-hi-trow">
          <Avatar initials={r.who.initials} tint={r.who.tint} size={36} />
          <span class="ow-b-hi-tt"><b>{firstWord(r.who.name)}</b><span class={r.warn ? 'warn' : ''}>{r.what}</span></span>
          <span class={'ow-b-hi-mark ' + (p.live ? 'live' : p.kept ? 'kept' : 'told')}
            aria-label={p.live ? 'Telling' : p.kept ? 'Sends when online' : 'Told'}>
            {p.live ? <span class="ow-b-hi-spin" /> : <Icon name={p.kept ? 'clock' : 'check'} size={14} stroke={2.4} />}
          </span>
        </div>
      ))}
    </div>
  );
}
