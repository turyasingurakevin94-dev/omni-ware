/*
 * Alerts (TD10, TD29): the pushes this phone got, each with its sender's face and where it stands now;
 * the bell's count (WORD-10: only today's for-you alerts, and only those since Alerts was last opened,
 * kept on this phone as ow-store-seen:<uid>:<shop>, data §0).
 */
import { firstWord, orderNo } from '../../../core/names.ts';
import { whoIs } from '../../../core/store/faces.ts';
import { aisleLetter } from '../../../core/store/counts.ts';
import type { YardAlert, YardBooks } from '../../../core/store/types.ts';
import { dayOf, when } from '../../../core/time.ts';
import type { IconName } from '../../../ui/icons.tsx';

const seenKey = (b: YardBooks): string => `ow-store-seen:${b.me.userId || b.me.id}:${b.shopName}`;

export function seenAt(b: YardBooks): number {
  try { return Number(localStorage.getItem(seenKey(b)) || 0); } catch (_e) { return 0; }
}
export function markSeen(b: YardBooks, now: number): void {
  try { localStorage.setItem(seenKey(b), String(now)); } catch (_e) { /* private mode */ }
}

/** The bell: today's alerts for you, not read yet. */
export function bellCount(b: YardBooks, now: number): number {
  const seen = seenAt(b), today = dayOf(now);
  return b.alerts.filter((a) => a.forYou && dayOf(a.at) === today && a.at > seen).length;
}

export interface AlertSaid {
  a: YardAlert;
  title: string;
  sub: string;
  /** Where it stands now: the pill's word, tone and icon. */
  now: { word: string; tone: 'neutral' | 'info' | 'good'; icon?: IconName };
  route: { id: string; params: Record<string, string | number> };
}

const nameOf = (s: string): string => s.split(' · ')[0];

/** One push, said in the yard's words, with where it stands now (TD10). */
export function sayAlert(a: YardAlert, b: YardBooks, now: number): AlertSaid {
  const from = whoIs(b, a.fromId), who = from ? firstWord(from.name) : '';
  const at = when(a.at, now), oid = a.data.orderId != null ? Number(a.data.orderId) : null, key = a.data.key != null ? String(a.data.key) : null;
  const o = oid != null ? b.orders.find((x) => x.id === oid) : null, it = key ? b.items.find((x) => x.key === key) : null;
  switch (a.kind) {
    case 'order.pick': {
      const collect = /they collect/.test(a.text);
      return { a, title: `New to pack · ${collect ? 'they collect' : 'we deliver'}`, sub: `${oid != null ? orderNo(oid) : ''} · ${who} · ${at}`,
        now: o && o.pickingStatus === 'done' ? { word: 'Packed', tone: 'good', icon: 'check' } : { word: 'To pack', tone: 'info', icon: 'orders' }, route: { id: 'pack', params: oid != null ? { first: oid } : {} } };
    }
    case 'trip.back': {
      const t = b.trips.find((x) => x.id === a.data.tripId), n = t ? t.lines.length : 0;
      return { a, title: 'Trip back at the yard', sub: `${n} ${n === 1 ? 'line' : 'lines'} · ${who} · ${at}`,
        now: t && t.yardCheckedAt ? { word: 'Checked in', tone: 'good', icon: 'check' } : { word: 'Check it in', tone: 'info' }, route: { id: 'in/checkin', params: { trip: String(a.data.tripId || '') } } };
    }
    case 'order.copy':
      return { a, title: 'A copy · don’t pack it', sub: `${oid != null ? orderNo(oid) : ''} · ${who} · ${at}`, now: { word: 'Look only', tone: 'neutral', icon: 'eye' }, route: { id: 'pack/look', params: oid != null ? { id: oid } : {} } };
    case 'stock.count.sent': case 'stock.count.decided':
      return { a, title: a.kind === 'stock.count.sent' ? 'Count · Ruth is looking' : 'Count · Ruth decided', sub: `${it ? nameOf(it.name) : ''} · ${at}`,
        now: { word: a.kind === 'stock.count.sent' ? 'With Ruth' : 'Decided', tone: 'info' }, route: { id: key && a.kind === 'stock.count.sent' ? 'shelf/count' : 'shelf/item', params: key ? { key } : {} } };
    case 'product.new': {
      const letter = it ? aisleLetter(b, it.category) : '';
      return { a, title: `New item · ${it ? nameOf(it.name) : ''}`, sub: `${letter ? `aisle ${letter} · ` : ''}${who} · ${at}`,
        now: { word: it ? `${it.books} on shelf` : 'On the shelf', tone: 'neutral' }, route: { id: 'shelf/item', params: key ? { key } : {} } };
    }
    case 'order.moved':
      return { a, title: `${who} marked it delivered`, sub: `${oid != null ? orderNo(oid) : ''}${a.data.place ? ` · ${a.data.place}` : ''} · ${at}`, now: { word: 'Delivered', tone: 'good', icon: 'orders' }, route: { id: 'out/road', params: {} } };
    default:
      return { a, title: a.text, sub: `${who} · ${at}`, now: { word: 'Open', tone: 'neutral' }, route: { id: 'today', params: {} } };
  }
}

export interface AlertDay { day: string; forYou: AlertSaid[]; yard: AlertSaid[]; read: boolean }

/** Today's in two groups (for you · in the yard), newest first; earlier days after, read. */
export function alertDays(b: YardBooks, now: number): AlertDay[] {
  const today = dayOf(now), days = [...new Set(b.alerts.map((a) => dayOf(a.at)))].sort().reverse();
  if (!days.includes(today)) days.unshift(today);
  return days.map((d) => {
    const list = b.alerts.filter((a) => dayOf(a.at) === d).sort((x, y) => y.at - x.at).map((a) => sayAlert(a, b, now));
    return { day: d, forYou: list.filter((x) => x.a.forYou), yard: list.filter((x) => !x.a.forYou), read: d !== today };
  });
}
