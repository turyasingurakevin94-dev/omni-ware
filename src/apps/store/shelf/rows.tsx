/*
 * An item as a row, and its state as chips: the same words on Find, the aisle and the scanner.
 *
 *   itemState(b, it, at)   with Ruth · count due · order in · low · on shelf (blind: a due item shows no figure)
 *   StateChips             "RN With Ruth", "Count due", "Order in", "412 on shelf", "Low"
 *   ItemRow                the square, the name (the typed words marked), the chips and a line, a chevron
 *   OrderRow               a face, the customer, "#0530 · 1 ctn", where it is ("Packed · 2 days", "Buying")
 */
import { orderFace, personFace } from '../../../core/store/faces.ts';
import type { ComponentChildren, JSX } from 'preact';
import { orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { countDue, daysSince, recountOf, spotPlace, waitingFor } from '../../../core/store/counts.ts';
import { letterOf, lookOf, onShelf, orderIn } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardBooks, YardOrder } from '../../../core/store/types.ts';
import { stageOf } from '../../../core/store/yard.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { ItemPic } from './glyphs.tsx';
import { unitWord } from './parts.tsx';
import './rows.css';

export interface ItemState { ruth: boolean; due: boolean; recount: boolean; orderIn: ReturnType<typeof orderIn>; shelf: number | null; low: boolean; at: number | null }

export function itemState(b: YardBooks, it: ShelfItem, now: number): ItemState {
  const w = waitingFor(b, spotPlace(it)), due = countDue(it, b, now), oi = orderIn(b, it.key), look = lookOf(b, it, now);
  return { ruth: !!w, due, recount: !!recountOf(b, it.key), orderIn: oi, shelf: due ? null : onShelf(b, it.key), low: look === 'low' || look === 'out', at: w ? w.createdAt : null };
}

/** The rank Find sorts equal matches by: with Ruth, count due, on the shelf, order in, the rest. */
export const stateRank = (s: ItemState): number => (s.ruth ? 0 : s.due ? 1 : s.shelf ? 2 : s.orderIn.length ? 3 : 4);

export function Chip(p: { tone: 'ruth' | 'due' | 'in' | 'shelf' | 'low' | 'buy' | 'late' | 'done'; children: ComponentChildren }): JSX.Element {
  return <span class={cx('sh-chip', p.tone)}>{p.children}</span>;
}

export function StateChips(p: { b: YardBooks; it: ShelfItem; s: ItemState; ruth: { initials: string; tint: string } }): JSX.Element {
  const s = p.s;
  if (s.ruth) return <Chip tone="ruth"><span aria-hidden="true" class="sh-chip-face">{p.ruth.initials}</span>With Ruth</Chip>;
  if (s.due) return <Chip tone="due"><Icon name="blind" size={13} stroke={2} />Count due</Chip>;
  if (s.orderIn.length && !s.shelf) return <Chip tone="in">Order in</Chip>;
  return <><Chip tone="shelf"><span class="mono">{s.shelf}</span> on shelf</Chip>{s.low && <Chip tone="low">Low</Chip>}</>;
}

/** The line after the chips: "you counted 9:21", "C · by the kg", "4 box · for #0549", "new today". */
export function stateLine(b: YardBooks, it: ShelfItem, s: ItemState, now: number): string {
  if (s.ruth && s.at != null) return `you counted ${clock(s.at)}`;
  if (s.orderIn.length && !s.shelf) { const o = s.orderIn[0]; return `${o.qty > 1 ? `${o.qty} ${o.unit} · ` : ''}for ${orderNo(o.order.id)}`; }
  if (s.due) return `${letterOf(b, it.category) || '?'} · by the ${unitWord(it.unit)}`;
  if (it.listedAt != null && daysSince(it.listedAt, now) === 0) return 'new today';
  return '';
}

/** The typed words marked in a name. */
export function Marked(p: { text: string; q: string }): JSX.Element {
  const w = p.q.trim().toLowerCase(), i = w ? p.text.toLowerCase().indexOf(w) : -1;
  if (i < 0) return <>{p.text}</>;
  return <>{p.text.slice(0, i)}<mark>{p.text.slice(i, i + w.length)}</mark>{p.text.slice(i + w.length)}</>;
}

export function ItemRow(p: { b: YardBooks; it: ShelfItem; s: ItemState; q?: string; line?: string; on: () => void; label?: string }): JSX.Element {
  const ruth = personFace(p.b.people.find((x) => x.role === 'manager'));
  return (
    <Tap on={p.on} class="sh-irow" label={p.label}>
      <ItemPic it={p.it} size={40} radius={12} />
      <span class="sh-irow-t">
        <span><Marked text={p.it.name} q={p.q || ''} /></span>
        <span class="sh-irow-s"><StateChips b={p.b} it={p.it} s={p.s} ruth={ruth} />{p.line != null && p.line !== '' && <span>{p.line}</span>}</span>
      </span>
      <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </Tap>
  );
}

/** Where an order is, in the yard's words, as a chip ("Packed · 2 days" red when it waits a day or more). */
export function OrderChip(p: { b: YardBooks; o: YardOrder; me: string | null; now: number }): JSX.Element {
  const st = stageOf(p.o, p.b, p.me, p.now);
  switch (st) {
    case 'packed': { const d = p.o.pickingDoneAt != null ? daysSince(p.o.pickingDoneAt, p.now) : 0; return <Chip tone={d >= 1 ? 'late' : 'shelf'}>{d >= 1 ? <>Packed · <span class="mono">{d}</span> {d === 1 ? 'day' : 'days'}</> : `Packed${p.o.bay ? ' · Bay ' + p.o.bay : ''}`}</Chip>; }
    case 'delivered': return <Chip tone="done">{`Delivered ${p.o.deliveredAt ? clock(p.o.deliveredAt) : ''}`.trim()}</Chip>;
    case 'waiting': return <Chip tone="buy"><Icon name="cart" size={13} stroke={2} />Buying</Chip>;
    case 'road': return <Chip tone="buy"><Icon name="truck" size={13} stroke={2} />On the road</Chip>;
    case 'ready': return <Chip tone="buy">Ready to collect</Chip>;
    case 'to-pack': case 'for-you': return <Chip tone="shelf">To pack</Chip>;
    case 'packing': return <Chip tone="shelf">Packing now</Chip>;
    case 'cancelled': return <Chip tone="late">Cancelled</Chip>;
    default: return <Chip tone="shelf">Look only</Chip>;
  }
}

export function OrderRow(p: { b: YardBooks; o: YardOrder; what: string; me: string | null; now: number; on: () => void }): JSX.Element {
  const name = p.o.client.name || 'Walk-in';
  return (
    <Tap on={p.on} class="sh-orow" label={`${name}, ${orderNo(p.o.id)}`}>
      <Avatar {...orderFace(p.o, p.b)} size={36} font={12} />
      <span class="sh-orow-t"><span>{name}</span><span class="mono">{`${orderNo(p.o.id)}${p.what ? ' · ' + p.what : ''}`}</span></span>
      <OrderChip b={p.b} o={p.o} me={p.me} now={p.now} />
    </Tap>
  );
}

/** Where an order row goes (routes §3): the order's own screen by its stage. */
export function openOrder(b: YardBooks, o: YardOrder, me: string | null, now: number, push: (id: string, p: Record<string, unknown>) => void): void {
  const st = stageOf(o, b, me, now);
  if (st === 'packed') push('out/load', {});
  else if (st === 'ready') push('out/gate', { id: o.id });
  else if (st === 'road' || st === 'coming-back') push('out/road', {});
  else if ((st === 'to-pack' || st === 'for-you' || st === 'packing') && (!o.assignedWorkerId || o.assignedWorkerId === me)) push('pack/order', { id: o.id });
  else push('pack/look', { id: o.id });
}
