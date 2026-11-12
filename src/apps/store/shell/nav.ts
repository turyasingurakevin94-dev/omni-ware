/*
 * The Store's screen stack (spec 07: one stack per app, no router library), the
 * Buyer's way (src/apps/buyer/shell/nav.ts). Two tab roots, Today and Shelf; the
 * red centre opens the next job (shell/next-job.ts). Ids are routes.ts's.
 *
 *   nav.tab('shelf')                 the stack becomes [its root]
 *   nav.push('pack/order', { id })   a screen on top (a stage id opens its sheet over Today)
 *   nav.back()                       the one below (phone and browser Back do the same, NAV-02)
 *   nav.replace('pack', {})          swap the top (a stage sheet's rail, an end-of-flow screen)
 *   nav.home()                       "Back to Today", never a pushed today (routes §3)
 *   nav.to('shelf/item', { key })    Close: to the board's place, down the stack when it is there (else in the top's place)
 *   backTo                           the way-back strip's words, from the entry really below ("Back to Find")
 *
 * A reload reopens the same screen (NAV-09; store.html:2035 saveView): the stack is kept in
 * sessionStorage under ow-store-view. An open sheet has its own history entry, so Back closes
 * it and stays on the screen under it. A second tap on Back before the first lands pops one.
 */
import { computed, effect, signal } from '@preact/signals';
import type { JSX } from 'preact';
import { sheet } from '../../../ui/sheet.tsx';
import { isTab, RAIL, route } from './routes.ts';

export type Params = Record<string, string | number | boolean | null | undefined>;
export type Tab = 'today' | 'shelf';
/** bars: false: the screen draws the Not done bars itself (over its dock, IN08). */
export interface ScreenDef { view: (p: { params: Params }) => JSX.Element; tabBar?: boolean; bars?: boolean }

const REG = signal<Record<string, ScreenDef>>({});
let missing: (id: string) => ScreenDef | undefined = () => undefined;
/**
 * The screens, given by screens.ts: the shell's and Today's at once, with what stands in for
 * an id not here (a lazy area's loading state, shell/areas.ts; else its placeholder).
 */
export function register(r: Record<string, ScreenDef>, fallback?: (id: string) => ScreenDef | undefined): void {
  REG.value = r;
  if (fallback) missing = fallback;
}
/** A lazy area's screens, when its file arrives (shell/areas.ts): they take their ids' places. */
export function addScreens(r: Record<string, ScreenDef>): void { REG.value = { ...REG.value, ...r }; }
export function screen(id: string): ScreenDef | undefined { return REG.value[id] || missing(id); }

export interface Entry { id: string; params: Params; key: number }
let keys = 0;
const entry = (id: string, params: Params = {}): Entry => ({ id, params, key: ++keys });

const VIEW = 'ow-store-view';
function restored(): Entry[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW) || 'null');
    if (Array.isArray(v) && v.length && v.every((e) => e && route(String(e.id)) && route(String(e.id))?.kind !== 'full')) return v.map((e) => entry(String(e.id), e.params || {}));
  } catch (_e) { /* no storage: start on Today */ }
  return [entry('today')];
}

export const stack = signal<Entry[]>(typeof window === 'undefined' ? [entry('today')] : restored());
export const top = computed(() => stack.value[stack.value.length - 1]);
/** The top is a stage sheet: drawn over the screen under it (Today). */
export const isStage = computed(() => route(top.value.id)?.kind === 'stage');
/** The screen drawn under a stage sheet: the nearest entry below that is not one. */
export const under = computed<Entry>(() => [...stack.value].reverse().find((e) => route(e.id)?.kind !== 'stage') || stack.value[0]);
export const barTab = computed<Tab | null>(() => {
  const r = stack.value[0].id;
  return r === 'today' || r === 'shelf' ? r : null;
});
/** The bar shows on a tab root alone on the stack, unless the screen says otherwise. */
export const showTabBar = computed(() => {
  const s = screen(top.value.id);
  if (s && s.tabBar != null) return s.tabBar;
  return stack.value.length === 1 && route(top.value.id)?.kind === 'tab';
});

/** What a place is called on its way back: one list, the stack's entries named (F5). */
const NAME: Record<string, (p: Params) => string> = {
  today: () => 'Today', shelf: () => 'Shelf', 'shelf/find': () => 'Find', 'shelf/aisle': (p) => (p.aisle ? String(p.aisle) : 'No aisle yet'),
  'shelf/item': () => 'the item', 'shelf/count': (p) => (p.key ? 'the count' : 'the aisle count'), 'shelf/report': () => 'the report',
  'shelf/scan': () => 'the scanner', 'shelf/ask': () => 'the ask', 'pack/order': () => 'the order',
  'out/door': () => 'the door', 'out/gate': () => 'the gate',
};
const nameOf = (e: Entry): string | null => (NAME[e.id] ? NAME[e.id](e.params) : RAIL.find((x) => x.id === e.id)?.word ?? null);
/** "Back to Find": the entry below the top, by name ("Back" when it has none). */
export const backTo = computed(() => {
  const e = stack.value[stack.value.length - 2], n = e ? nameOf(e) : null;
  return n ? `Back to ${n}` : 'Back';
});

function setStack(next: Entry[], pushHistory: boolean): void {
  stack.value = next;
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(VIEW, JSON.stringify(next.map((e) => ({ id: e.id, params: e.params })))); } catch (_e) { /* private mode */ }
  if (pushHistory) history.pushState({ depth: next.length }, '');
  window.scrollTo(0, 0);
}

let pending = 0, pendingTimer = 0, sheetEntry = false, ours = 0;
const known = (id: string) => { if (!route(id) && !screen(id)) throw new Error(`No screen "${id}"`); };

export const nav = {
  tab(t: Tab): void { setStack([entry(t)], false); },
  push(id: string, params: Params = {}): void { known(id); setStack([...stack.value, entry(id, params)], true); },
  replace(id: string, params: Params = {}): void { known(id); setStack([...stack.value.slice(0, -1), entry(id, params)], false); },
  back(): void {
    if (pending || stack.value.length <= 1) return;
    pending++;
    history.back();
    clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = 0; }, 1000);
  },
  home(): void { setStack([entry('today')], false); },
  /**
   * Close: to the place the board's Close links. Down the stack to it when it is below (Back's history walked with
   * it); else a tab becomes the stack's root, any other place takes the top's.
   */
  to(id: string, params?: Params): void {
    known(id);
    const s = stack.value, same = (e: Entry) => e.id === id && (!params || Object.keys(params).every((k) => String(e.params[k]) === String(params[k])));
    for (let i = s.length - 2; i >= 0; i--) {
      if (!same(s[i])) continue;
      if (typeof window !== 'undefined') { ours++; history.go(-(s.length - 1 - i)); }
      setStack(s.slice(0, i + 1), false);
      return;
    }
    if (isTab(id)) nav.tab(id as Tab);
    else nav.replace(id, params);
  },
  /** A full-screen shell route (sign-in, checking, no reach): the stack is only it. */
  only(id: string): void { known(id); stack.value = [entry(id)]; },
};

if (typeof window !== 'undefined') {
  history.replaceState({ depth: 1 }, '');
  // A reloaded stack deeper than one: give each its history entry back, so Back walks it.
  for (let i = 1; i < stack.peek().length; i++) history.pushState({ depth: i + 1 }, '');
  effect(() => {
    const open = sheet.isOpen;
    if (open && !sheetEntry) { sheetEntry = true; history.pushState({ depth: stack.peek().length, sheet: true }, ''); }
    else if (!open && sheetEntry) { sheetEntry = false; ours++; history.back(); }
  });
  window.addEventListener('popstate', () => {
    if (ours) { ours--; return; }
    if (sheetEntry) { sheetEntry = false; sheet.close(); if (pending) history.back(); return; }
    if (pending) pending--;
    if (stack.value.length > 1) setStack(stack.value.slice(0, -1), false);
  });
}
