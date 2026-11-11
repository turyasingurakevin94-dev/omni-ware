/*
 * Waiting to send (docs/spec/04-screens-store.md §4.8; REL-04, NAV-09): one list on Today of every
 * write kept on this phone, each said in the yard's words with who sees it once it goes (TD06):
 *
 *   "#0552 · 40 pc packed"   → Grace     (a pick: the salesperson sees Packing move)
 *   "Report · 3 bent sheets" → Ruth      (a loss, a count, a return: Ruth decides)
 *
 * keptLine(k, b) says one kept write (core/outbox.ts Kept); it never reads the books' figures.
 */
import type { Kept } from '../outbox.ts';
import { orderNo, plural } from '../names.ts';
import type { YardBooks, YardPerson } from './types.ts';

export type KeptIcon = 'pack' | 'report' | 'count' | 'checkin' | 'return' | 'truck' | 'gate' | 'other';
export interface KeptLine { title: string; icon: KeptIcon; who: YardPerson | null }

const arg = <T>(k: Kept, i: number): T => (Array.isArray(k.args) ? k.args[i] : k.args) as T;

/** The noun a person says for an item: "Iron sheet G28 · 3m" → "sheet". */
function noun(name: string): string {
  const words = name.split(' · ')[0].split(/\s+/).filter((w) => /^[A-Za-z]+$/.test(w));
  return (words[words.length - 1] || 'item').toLowerCase();
}

export function keptLine(k: Kept, b: YardBooks): KeptLine {
  const ruth = b.people.find((p) => p.role === 'manager') || null;
  const sellerOf = (id: number) => { const o = b.orders.find((x) => x.id === id); return (o && b.people.find((p) => p.userId === o.takenBy)) || null; };
  switch (k.kind) {
    case 'pick': case 'finishPack': case 'claim': {
      const id = Number(arg<number>(k, 0)), o = b.orders.find((x) => x.id === id);
      const done = k.kind === 'pick' ? (arg<{ idx: number; status: string; qty: number }[]>(k, 1) || []).filter((a) => a.status === 'done') : [];
      const l = o && done[0] ? o.lines[done[0].idx] : null;
      return { title: l ? `${orderNo(id)} · ${done[0].qty} ${l.unit} packed` : `${orderNo(id)} · packed`, icon: 'pack', who: sellerOf(id) };
    }
    case 'reportLoss': {
      const r = arg<{ name: string; qty: number; note?: string; why: string }>(k, 0);
      const word = (r.note || r.why).toLowerCase();
      return { title: `Report · ${r.qty} ${word} ${plural(r.qty, noun(r.name))}`, icon: 'report', who: ruth };
    }
    case 'sendCount': case 'replaceCount': {
      const c = arg<{ aisle: string }>(k, k.kind === 'replaceCount' ? 1 : 0);
      return { title: `Count · ${String(c.aisle).replace(/^Spot count · /, '')}`, icon: 'count', who: ruth };
    }
    case 'returnAsk': return { title: `Return · ${orderNo(arg<{ orderId: number }>(k, 0).orderId)}`, icon: 'return', who: ruth };
    case 'checkIn': case 'rideHandIn': return { title: 'Check-in · trip', icon: 'checkin', who: b.people.find((p) => p.role === 'buyer') || null };
    case 'load': return { title: `Loaded · ${(arg<number[]>(k, 0) || []).map(orderNo).join(' ')}`, icon: 'truck', who: null };
    case 'handOver': return { title: `${orderNo(arg<number>(k, 0))} · handed over`, icon: 'gate', who: sellerOf(arg<number>(k, 0)) };
    case 'deliver': return { title: `${orderNo(arg<number>(k, 0))} · delivered`, icon: 'truck', who: sellerOf(arg<number>(k, 0)) };
    default: return { title: k.kind, icon: 'other', who: null };
  }
}
