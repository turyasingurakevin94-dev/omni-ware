/*
 * What the To pack sheet shows (PK01, PK08, PK13, PK14, PK20), worked out once from the yard's
 * rules (core/store/yard.ts, pack.ts, faces.ts): the chips and their counts, the sections in the
 * order the chosen chip puts them, each row's words, and the head's line.
 */
import { signal } from '@preact/signals';
import { firstWord, orderNo } from '../../../core/names.ts';
import { customerFace, personFace, whoIs, type YardFace, yardFace } from '../../../core/store/faces.ts';
import { lineMark, packLines, progress, whereOf, type LineMark } from '../../../core/store/pack.ts';
import { counts, moneyHeld, onATruck, ordersAt, waitingSince, isMine, NOT_PAID } from '../../../core/store/yard.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { clock, dayLabel, dayOf, daysApart, howLong } from '../../../core/time.ts';

export type Chip = 'for-you' | 'to-pack' | 'packing' | 'packed' | 'waiting';

export const CHIPS: { id: Chip; word: string; dot: string }[] = [
  { id: 'for-you', word: 'For you', dot: '#0F6B43' },
  { id: 'to-pack', word: 'To pack', dot: '#8DA2D6' },
  { id: 'packing', word: 'Packing now', dot: '#7FA2D6' },
  { id: 'packed', word: 'Packed', dot: '#F5B26B' },
  { id: 'waiting', word: 'Waiting on goods', dot: '#C9C4BA' },
];

/** The chip the person tapped (null: the sheet picks), and an order someone else just took ("#0556 moved here", PK13). */
export const chipPicked = signal<Chip | null>(null);
export const moved = signal<{ id: number; by: string } | null>(null);

export interface Row {
  kind: 'pack' | 'copy' | 'mine' | 'theirs' | 'packed' | 'cancelled';
  o: YardOrder;
  face: YardFace;
  badge: YardFace | null;
  name: string;
  sub: string;
  /** The waiting pill ("39m"), or the packed one ("2d on the bay"). */
  pill: string | null;
  pillBad: boolean;
  /** Mine: the mini bar and "1 of 2 packed · Ntinda". */
  marks: LineMark[];
  done: string;
  to: string;
  pickup: boolean;
  notPaid: boolean;
  /** Theirs: whose ("Okello's"). */
  whose: string;
  /** For you: who else sees it as yours ("Okello sees it as Musa's"). */
  seenBy: string | null;
}

/** "39m": how long, written tight for a pill. */
export const tight = (from: number, to: number): string => {
  const h = howLong(from, to);
  return /days?$/.test(h) ? h.replace(/ days?$/, 'd') : h.replace(/ /g, '');
};

export function rowFor(kind: Row['kind'], o: YardOrder, b: YardBooks, me: string | null, now: number): Row {
  const c = customerFace(o, b), w = whereOf(o, b), packer = whoIs(b, o.assignedWorkerId);
  const giver = kind === 'pack' && o.assignedWorkerId && isMine(o, me) ? b.people.find((p) => p.role === 'manager') || null : null;
  const p = progress(o), cur = packLines(o).find((l) => l.pickStatus !== 'done' && l.pickStatus !== 'short') || null;
  const days = o.pickingDoneAt != null ? daysApart(dayOf(o.pickingDoneAt), dayOf(now)) : 0;
  const mate = b.people.find((x) => x.role === 'store' && x.id !== me && !x.away);
  return {
    kind, o, face: c, name: c.name,
    // A packer's small face keeps their own tint (FACTS §1: MK slate), not the phone holder's navy.
    badge: kind === 'mine' || kind === 'theirs' ? (packer ? yardFace(b, packer) : null) : giver ? personFace(giver) : null,
    sub: '', pill: kind === 'pack' ? tight(waitingSince(o), now) : kind === 'packed' && days >= 1 ? `${days}d on the bay` : null,
    pillBad: kind === 'packed',
    marks: o.lines.map((l) => lineMark(o, l, cur)), done: `${p.done} of ${p.of}`, to: w.pickup ? 'they collect' : w.to.split(' ')[0], pickup: w.pickup,
    notPaid: moneyHeld(o), whose: packer ? `${firstWord(packer.name)}’s` : '',
    seenBy: giver && mate ? `${firstWord(mate.name)} sees it as ` : null,
  };
}

export interface Sheet {
  title: number;
  sub: string;
  chips: Record<Chip, number>;
  picked: Chip;
  order: Chip[];
  forYou: Row[];
  toPack: Row[];
  packing: Row[];
  packed: Row[];
  waiting: YardOrder[];
  /** Waiting on goods: the buyer bringing them and when (PK01 "Denis is buying · back ~11:30"). */
  buyer: { face: YardFace; name: string; due: number | null } | null;
  packingMeta: string;
  packedMeta: string;
  forYouMeta: string;
  empty: boolean;
}

export function sheetOf(b: YardBooks, me: string | null, now: number): Sheet {
  const c = counts(b, me, now);
  const forYou = ordersAt(b, 'for-you', me, now).map((o) => rowFor('pack', o, b, me, now));
  const copies = b.orders.filter((o) => o.copyOf != null && o.status === 'preparing' && ordersAt(b, 'look', me, now).includes(o));
  const toPack = [...ordersAt(b, 'to-pack', me, now).map((o) => rowFor('pack', o, b, me, now)), ...copies.map((o) => rowFor('copy', o, b, me, now))];
  const packing = ordersAt(b, 'packing', me, now).map((o) => rowFor(isMine(o, me) ? 'mine' : 'theirs', o, b, me, now));
  const cancelled = ordersAt(b, 'cancelled', me, now).filter((o) => !onATruck(o) && o.status !== 'pending_delivery');
  const packed = [...cancelled.map((o) => rowFor('cancelled', o, b, me, now)), ...ordersAt(b, 'packed', me, now).map((o) => rowFor('packed', o, b, me, now))];
  // Waiting on goods in the books' order (the one whose trip is back first leads, PK01).
  const waiting = b.orders.filter((o) => ordersAt(b, 'waiting', me, now).includes(o));
  const trip = b.trips.find((t) => !t.voided && !t.yardCheckedAt && t.runnerId !== '__supplier__' && t.lines.some((l) => l.orderId != null && waiting.some((o) => o.id === l.orderId)));
  const runner = trip ? whoIs(b, trip.runnerId) : null;
  const chips: Record<Chip, number> = { 'for-you': c.forYou, 'to-pack': c.toPack - c.forYou, packing: c.packingNow, packed: c.packed, waiting: c.waitingOnGoods };
  const mv = moved.value;
  const picked: Chip = chipPicked.value || (mv ? 'packing' : c.forYou ? 'for-you' : 'to-pack');
  // The chosen chip's group first, then For you · Packing now · To pack · Packed · Waiting on goods (PK01, PK08, PK13).
  const order = [picked, ...(['for-you', 'packing', 'to-pack', 'packed', 'waiting'] as Chip[]).filter((x) => x !== picked)];
  const mine = packing.find((r) => r.kind === 'mine');
  const oldest = ordersAt(b, 'to-pack', me, now)[0];
  const fy = forYou[0];
  let sub: string;
  if (mv) sub = `${c.packingNow} packing now · ${mv.by} took ${orderNo(mv.id)}`;
  else if (fy) sub = `for you · from ${fy.badge ? firstWord(b.people.find((p) => p.role === 'manager')?.name || '') : ''} ${fy.o.pickingAssignedAt != null ? clock(fy.o.pickingAssignedAt) : ''}`.replace(/ +/g, ' ').trim();
  else if (oldest) sub = `${orderNo(oldest.id)} waiting ${howLong(waitingSince(oldest), now)}${c.packingNow ? ` · ${c.packingNow} packing` : ''}`;
  else sub = `all packed · ${c.deliveredToday} delivered today`;
  const firstPacked = ordersAt(b, 'packed', me, now)[0];
  const manager = b.people.find((p) => p.role === 'manager');
  return {
    title: c.toPack, sub, chips, picked, order, forYou, toPack, packing, packed, waiting,
    buyer: runner ? { face: personFace(runner), name: firstWord(runner.name), due: trip ? trip.dueAt : null } : null,
    packingMeta: mv ? `${orderNo(mv.id)} moved here` : mine && mine.o.workerAcceptedAt != null ? `yours · since ${clock(mine.o.workerAcceptedAt)}` : '',
    packedMeta: firstPacked && firstPacked.pickingDoneAt != null ? `packed ${dayOf(firstPacked.pickingDoneAt) === dayOf(now) ? clock(firstPacked.pickingDoneAt) : dayLabel(firstPacked.pickingDoneAt)}` : '',
    forYouMeta: manager ? `${firstWord(manager.name)}’s pick` : '',
    empty: !c.toPack && !c.packingNow,
  };
}

export { NOT_PAID };
