/*
 * One screen stack for a role app (spec 07: one stack per app, no router library),
 * from the Store's (src/apps/store/shell/nav.ts) made shareable: the app gives its
 * route kinds, tab roots and names; the stack does the rest. The Manager uses it;
 * the Store and the Buyer still carry their own copies, to move onto this (docs/rebuild.md log).
 *
 *   const { nav, stack, top, under, … } = createStack({ key: 'ow-manager-view', home: 'today', kindOf, nameOf })
 *   nav.tab('money')             the stack becomes [its root]
 *   nav.push('orders/order', { id })  a screen on top (a 'sheet' id rises over the screen under it)
 *   nav.back()                   the one below (phone and browser Back do the same)
 *   nav.replace(id, params)      swap the top
 *   nav.home()                   "Back to Today"
 *   nav.only(id)                 a full-screen shell route
 *
 * A reload reopens the same screen: the stack is kept in sessionStorage under `key`. An open
 * light sheet (src/ui/sheet.tsx) has its own history entry, so Back closes it first.
 */
import { computed, effect, signal, type ReadonlySignal } from '@preact/signals';
import type { JSX } from 'preact';
import { sheet } from './sheet.tsx';

export type Params = Record<string, string | number | boolean | null | undefined>;
/** tab: a tab root (the bar shows) · pushed: Back walks it · sheet: drawn over the screen under it · full: no bar, alone. */
export type RouteKind = 'tab' | 'pushed' | 'sheet' | 'full';
export interface ScreenDef { view: (p: { params: Params }) => JSX.Element | null; tabBar?: boolean; bars?: boolean }
export interface Entry { id: string; params: Params; key: number }

export interface StackConfig {
  /** sessionStorage key for the reload. */
  key: string;
  /** The home tab ("Back to Today"). */
  home: string;
  /** The kind of a route id, or null when the id is unknown. */
  kindOf: (id: string) => RouteKind | null;
  /** What an entry is called on a way-back strip ("Back to Orders"), or null. */
  nameOf?: (e: Entry) => string | null;
}

export interface Stack {
  nav: {
    tab(t: string): void;
    push(id: string, params?: Params): void;
    replace(id: string, params?: Params): void;
    back(): void;
    home(): void;
    only(id: string): void;
  };
  stack: ReadonlySignal<Entry[]>;
  top: ReadonlySignal<Entry>;
  /** The screen drawn under a sheet route: the nearest entry below that is not one. */
  under: ReadonlySignal<Entry>;
  isSheet: ReadonlySignal<boolean>;
  /** The tab whose root is at the bottom of the stack, or null. */
  barTab: ReadonlySignal<string | null>;
  showTabBar: ReadonlySignal<boolean>;
  backTo: ReadonlySignal<string>;
  register(r: Record<string, ScreenDef>, fallback?: (id: string) => ScreenDef | undefined): void;
  addScreens(r: Record<string, ScreenDef>): void;
  screen(id: string): ScreenDef | undefined;
}

export function createStack(cfg: StackConfig): Stack {
  const REG = signal<Record<string, ScreenDef>>({});
  let missing: (id: string) => ScreenDef | undefined = () => undefined;
  const screen = (id: string): ScreenDef | undefined => REG.value[id] || missing(id);
  let keys = 0;
  const entry = (id: string, params: Params = {}): Entry => ({ id, params, key: ++keys });
  const restored = (): Entry[] => {
    try {
      const v = JSON.parse(sessionStorage.getItem(cfg.key) || 'null');
      if (Array.isArray(v) && v.length && v.every((e) => e && cfg.kindOf(String(e.id)) && cfg.kindOf(String(e.id)) !== 'full')) return v.map((e) => entry(String(e.id), e.params || {}));
    } catch (_e) { /* no storage */ }
    return [entry(cfg.home)];
  };
  const stack = signal<Entry[]>(typeof window === 'undefined' ? [entry(cfg.home)] : restored());
  const top = computed(() => stack.value[stack.value.length - 1]);
  const isSheet = computed(() => cfg.kindOf(top.value.id) === 'sheet');
  const under = computed<Entry>(() => [...stack.value].reverse().find((e) => cfg.kindOf(e.id) !== 'sheet') || stack.value[0]);
  const barTab = computed<string | null>(() => (cfg.kindOf(stack.value[0].id) === 'tab' ? stack.value[0].id : null));
  const showTabBar = computed(() => {
    const s = screen(top.value.id);
    if (s && s.tabBar != null) return s.tabBar;
    return stack.value.length === 1 && cfg.kindOf(top.value.id) === 'tab';
  });
  const backTo = computed(() => {
    const e = stack.value[stack.value.length - 2], n = e && cfg.nameOf ? cfg.nameOf(e) : null;
    return n ? `Back to ${n}` : 'Back';
  });

  const setStack = (next: Entry[], pushHistory: boolean): void => {
    stack.value = next;
    if (typeof window === 'undefined') return;
    try { sessionStorage.setItem(cfg.key, JSON.stringify(next.map((e) => ({ id: e.id, params: e.params })))); } catch (_e) { /* private mode */ }
    if (pushHistory) history.pushState({ depth: next.length }, '');
    if (cfg.kindOf(next[next.length - 1].id) !== 'sheet') window.scrollTo(0, 0);
  };
  const known = (id: string) => { if (!cfg.kindOf(id) && !screen(id)) throw new Error(`No screen "${id}"`); };
  let pending = 0, pendingTimer = 0, sheetEntry = false, ours = 0;

  const nav: Stack['nav'] = {
    tab(t) { setStack([entry(t)], false); },
    push(id, params = {}) { known(id); setStack([...stack.value, entry(id, params)], true); },
    replace(id, params = {}) { known(id); setStack([...stack.value.slice(0, -1), entry(id, params)], false); },
    back() {
      if (pending || stack.value.length <= 1) return;
      pending++;
      history.back();
      clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(() => { pending = 0; }, 1000);
    },
    home() { setStack([entry(cfg.home)], false); },
    only(id) { known(id); stack.value = [entry(id)]; },
  };

  if (typeof window !== 'undefined') {
    history.replaceState({ depth: 1 }, '');
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

  return {
    nav, stack, top, under, isSheet, barTab, showTabBar, backTo, screen,
    register(r, fallback) { REG.value = r; if (fallback) missing = fallback; },
    addScreens(r) { REG.value = { ...REG.value, ...r }; },
  };
}
