/*
 * What Today keeps on this phone, per login (as sales.html keeps its drafts):
 *
 *   told      the tells done ("ask:SRC-PAINT", "price:552"); a price tell also writes markPriceTold
 *   searches  what Grace typed in Find, newest first ("You searched")
 *   misses    her searches that found nothing, with how often (TD20 "Found nothing this week";
 *             each is also logged for Sourcing with logSearchMiss)
 *   lately    what she opened from Find, newest first (TD11 "Lately")
 *   bigText   every size a step up, applied at start (TD18)
 *
 * Alerts are not kept here: they are this phone's row in push_subscriptions (DataSource.pushState).
 *
 * The demo seeds these from its state (seed/extra/today.ts), as store.ts seeds the drafts; a what-if
 * may seed the drafts too (TD02: 3 not placed yet; TD06, TD08: none).
 */
import { effect, signal } from '@preact/signals';
import type { PushState } from '../../../core/datasource.ts';
import type { DemoSource } from '../../../core/demo/index.ts';
import type { Ms } from '../../../core/types.ts';
import { isDemo, saveDrafts, session, source, type Draft } from '../shell/store.ts';

export interface Miss { words: string; n: number; at: Ms }
export interface Opened { kind: 'order' | 'customer' | 'item'; id: string }
export interface Local { told: string[]; searches: string[]; misses: Miss[]; lately: Opened[]; bigText: boolean }

const EMPTY: Local = { told: [], searches: [], misses: [], lately: [], bigText: false };
export const local = signal<Local>(EMPTY);
let loadedFor = '';

function key(): string {
  return 'ow-sales-today:' + (session.value ? session.value.userId : '');
}

/** What this phone keeps for this login, as stored (the demo: as seeded). */
function stored(k: string): Local {
  if (isDemo) return { ...EMPTY, ...(((source as DemoSource).state as unknown as { today?: Partial<Local> }).today || {}) };
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (_e) { return EMPTY; }
}

/** Read once per login (the demo's what-ifs seed the drafts too, once Today first draws). */
export function useLocal(): Local {
  const k = key();
  if (k !== loadedFor) {
    loadedFor = k;
    local.value = stored(k);
    const ds = isDemo ? (((source as DemoSource).state as unknown as { today?: { drafts?: Draft[] } }).today || {}).drafts : undefined;
    if (ds) queueMicrotask(() => saveDrafts(ds));
  }
  return local.value;
}

export function setLocal(patch: Partial<Local>): void {
  local.value = { ...local.value, ...patch };
  if ('bigText' in patch) zoom(local.value.bigText);
  if (isDemo) return;
  try { localStorage.setItem(key(), JSON.stringify(local.value)); } catch (_e) { /* storage full: kept in memory */ }
}

/** Big text: every size a step up. */
function zoom(on: boolean): void {
  if (typeof document !== 'undefined') document.body.style.zoom = on ? '1.125' : '';
}

/** At start, for each login: its big text applied, its pushes read (called once, from index.tsx). */
export function startLocal(): void {
  effect(() => {
    if (!session.value) return;
    zoom(stored(key()).bigText);
    void readPush();
  });
}

/** This phone's pushes as the books have them: null until read. */
export const push = signal<PushState | null>(null);

async function readPush(): Promise<void> {
  try { push.value = await source.pushState(); } catch (_e) { /* read again on the next sign-in */ }
}

/** Alerts on or off: this phone's push_subscriptions row saved or deleted; the switch shows what really happened. */
export async function setAlerts(on: boolean): Promise<PushState> {
  const r = on ? await source.pushOn() : await source.pushOff();
  push.value = r;
  return r;
}

/** Why alerts are off when they cannot simply be turned on here, in a few words (sales.html pushWhy). */
export const PUSH_WHY: Record<NonNullable<PushState['why']>, string> = {
  'not-app': 'alerts come in the installed app',
  'old-app': 'install the new Sales app for alerts',
  'denied': 'off in the phone’s settings',
  'no-play': 'this phone can’t get alerts',
};

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
