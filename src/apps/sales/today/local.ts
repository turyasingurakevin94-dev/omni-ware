/*
 * What Today keeps on this phone, per login (as sales.html keeps its drafts):
 *
 *   told      the tells done ("ask:SRC-PAINT", "price:552"); a price tell also writes markPriceTold
 *   searches  what Grace typed in Find, newest first ("You searched")
 *   misses    her searches that found nothing, with how often (TD20 "Found nothing this week";
 *             each is also logged for Sourcing with logSearchMiss)
 *   lately    what she opened from Find, newest first (TD11 "Lately")
 *   alerts    pushes on (TD18); bigText: every size a step up
 *
 * The demo seeds these from its state (seed/extra/today.ts), as store.ts seeds the drafts; a what-if
 * may seed the drafts too (TD02: 3 not placed yet; TD06, TD08: none).
 */
import { signal } from '@preact/signals';
import type { DemoSource } from '../../../core/demo/index.ts';
import type { Ms } from '../../../core/types.ts';
import { isDemo, saveDrafts, session, source, type Draft } from '../shell/store.ts';

export interface Miss { words: string; n: number; at: Ms }
export interface Opened { kind: 'order' | 'customer' | 'item'; id: string }
export interface Local { told: string[]; searches: string[]; misses: Miss[]; lately: Opened[]; alerts: boolean; bigText: boolean }

const EMPTY: Local = { told: [], searches: [], misses: [], lately: [], alerts: false, bigText: false };
export const local = signal<Local>(EMPTY);
let loadedFor = '';

function key(): string {
  return 'ow-sales-today:' + (session.value ? session.value.userId : '');
}

/** Read once per login. */
export function useLocal(): Local {
  const k = key();
  if (k !== loadedFor) {
    loadedFor = k;
    let v: Local = EMPTY;
    if (isDemo) {
      const seeded = ((source as DemoSource).state as unknown as { today?: Partial<Local> & { drafts?: Draft[] } }).today || {};
      v = { ...EMPTY, ...seeded };
      if (seeded.drafts) { const ds = seeded.drafts; queueMicrotask(() => saveDrafts(ds)); }
    } else {
      try { v = { ...EMPTY, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (_e) { v = EMPTY; }
    }
    local.value = v;
  }
  return local.value;
}

export function setLocal(patch: Partial<Local>): void {
  local.value = { ...local.value, ...patch };
  if (isDemo) return;
  try { localStorage.setItem(key(), JSON.stringify(local.value)); } catch (_e) { /* storage full: kept in memory */ }
}

export function markTold(k: string): void {
  if (!local.value.told.includes(k)) setLocal({ told: [...local.value.told, k] });
}

/** A search typed and kept: newest first, five at most; a miss counted. */
export function rememberSearch(words: string, found: boolean, at: Ms): void {
  const w = words.trim();
  if (w.length < 2) return;
  const searches = [w, ...local.value.searches.filter((x) => x.toLowerCase() !== w.toLowerCase())].slice(0, 5);
  let misses = local.value.misses;
  if (!found) {
    const hit = misses.find((m) => m.words.toLowerCase() === w.toLowerCase());
    misses = hit ? misses.map((m) => (m === hit ? { ...m, n: m.n + 1, at } : m)) : [...misses, { words: w.toLowerCase(), n: 1, at }];
  }
  setLocal({ searches, misses });
}

/** Something opened from Find: first in Lately. */
export function rememberOpened(o: Opened): void {
  setLocal({ lately: [o, ...local.value.lately.filter((x) => !(x.kind === o.kind && x.id === o.id))].slice(0, 3) });
}
