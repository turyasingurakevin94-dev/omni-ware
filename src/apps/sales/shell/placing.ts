/*
 * One place per draft (cross-app round 1, SAL-4; board SalesPlaceOnce). A place that could not reach the
 * books is kept by the outbox; its draft is then locked under the outbox id, shown on Placed as
 * "Waiting to send", and never placed a second time. When the kept place goes, the draft is cleared and the
 * Placed screen turns into the real order; when the books refuse it, the draft unlocks with the reason.
 * The server places a key once anyway (place_order, 0180): unlocking is always safe.
 */
import { signal } from '@preact/signals';
import type { Order } from '../../../core/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { nav } from './nav.ts';
import { drafts, kept, onKeptRefused, onKeptSent, saveDrafts, type Draft } from './store.ts';

/** Draft keys whose place is on its way right now (a second slide or Enter in the same moment is dropped). */
const inFlight = new Set<string>();
export const startPlacing = (key: string): boolean => { if (inFlight.has(key) || isLocked(key)) return false; inFlight.add(key); return true; };
export const endPlacing = (key: string): void => { inFlight.delete(key); };

/** The order that went, by draft key, for the Placed screen waiting on it. */
export const wentAs = signal<Record<string, number>>({});

export const isLocked = (key: string): boolean => drafts.value.some((d) => d.key === key && !!d.placing);

/** Keep the draft as it was placed, locked under the outbox id. */
export function lock(d: Draft, keptId: string): void {
  saveDrafts([...drafts.value.filter((x) => x.key !== d.key), { ...d, placing: keptId }]);
}

/** Unlock: it can be fixed and placed again (the books refused it, or the kept place was removed). */
export function unlockById(keptId: string): Draft | null {
  const d = drafts.value.find((x) => x.placing === keptId);
  if (!d) return null;
  saveDrafts(drafts.value.map((x) => (x.key === d.key ? { ...x, placing: undefined } : x)));
  return d;
}

let wired = false;
/** Listen once: a kept place went, or was refused. A lock whose kept write is gone is undone at start. */
export function wirePlacing(): void {
  if (wired) return;
  wired = true;
  onKeptSent((id, value) => {
    const d = drafts.value.find((x) => x.placing === id);
    if (!d) return;
    saveDrafts(drafts.value.filter((x) => x.key !== d.key));
    const o = value as Order | null;
    if (o && typeof o.id === 'number') wentAs.value = { ...wentAs.value, [d.key]: o.id };
    toast.show(`Placed · ${d.client.name}`, { kind: 'ok' });
  });
  onKeptRefused((id, reason) => {
    const d = unlockById(id);
    if (d) toast.show('Not placed', { kind: 'error', sub: reason, retry: () => nav.push('sell/order', { draft: d.key }) });
  });
  // The outbox is read before this runs: a lock with no kept write behind it (sent while the app was shut,
  // or removed) is undone; placing it again returns the same order (0180).
  const ids = new Set(kept.value.map((k) => k.id));
  drafts.value.filter((d) => d.placing && !ids.has(d.placing)).forEach((d) => { unlockById(d.placing as string); });
}
