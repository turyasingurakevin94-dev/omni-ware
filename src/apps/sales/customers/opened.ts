/*
 * "Opened lately" (CU05): the customers whose page was opened on this phone,
 * newest first. Kept on the phone per login (localStorage), like the drafts;
 * the demo's morning comes from its seed (extra/customers.ts, `openedLately`).
 */
import type { Books, Ms } from '../../../core/types.ts';
import { isDemo, session } from '../shell/store.ts';

export interface Opened { customerId: string; at: Ms }

const key = () => 'ow-sales-opened:' + (session.value ? session.value.userId : '');
let mem: Opened[] = [];

function load(): Opened[] {
  if (isDemo) return mem;
  try { return JSON.parse(localStorage.getItem(key()) || '[]') as Opened[]; } catch (_e) { return mem; }
}

/** What the books' seed says was opened (the demo only), and what this phone has opened since. */
export function openedOf(b: Books): Opened[] {
  const seeded = (b as Books & { openedLately?: Opened[] }).openedLately || [];
  return [...load(), ...seeded].sort((x, y) => y.at - x.at).slice(0, 4);
}

export function markOpened(customerId: string, at: Ms): void {
  const list = [{ customerId, at }, ...load().filter((o) => o.customerId !== customerId)].slice(0, 12);
  mem = list;
  if (isDemo) return;
  try { localStorage.setItem(key(), JSON.stringify(list)); } catch (_e) { /* storage full: kept in memory */ }
}
