/*
 * The screen stack (spec 07: one stack per app, no router library).
 *
 *   nav.tab('orders')                       a bar tab: the stack becomes [its root]
 *   nav.push('orders/order', { id: 552 })   a screen on top
 *   nav.back()                              the one below (the phone's back does the same)
 *   nav.replace('sell/placed', { id })      swap the top (an end-of-flow screen)
 *   nav.home()                              "Back to Today": the stack becomes [today]
 *
 * The phone's back button is history: each push adds an entry, back pops it.
 */
import { computed, signal } from '@preact/signals';
import { Loading } from './Loading.tsx';
import { TABS, isLoaded, loadTab, tabOfId } from './tabs.ts';
import type { Params, ScreenDef, TabId } from './types.ts';

export interface Entry {
  id: string;
  params: Params;
  /** A key per entry, so a screen opened twice is two screens. */
  key: number;
}

// Built on first use, not at load: the tab modules import nav, and nav imports them (tabs.ts).
// Built again when a tab's file arrives (TABS changes).
let SCREENS: Map<string, ScreenDef & { tab: TabId }> | null = null, BUILT = 0;
function registry(): Map<string, ScreenDef & { tab: TabId }> {
  const tabs = TABS.value;
  if (SCREENS && BUILT === tabs.length) return SCREENS;
  const m = new Map<string, ScreenDef & { tab: TabId }>();
  tabs.forEach((t) => {
    Object.entries(t.screens).forEach(([id, def]) => {
      if (m.has(id)) throw new Error(`Two screens are called "${id}": ${m.get(id)?.tab} and ${t.id}`);
      m.set(id, { ...def, tab: t.id });
    });
    if (!t.screens[t.root]) throw new Error(`The ${t.id} tab's root "${t.root}" is not one of its screens`);
  });
  SCREENS = m; BUILT = tabs.length;
  return m;
}

/** A screen of a tab whose file is not here yet: the canvas's loading state (P25) while it loads. */
const waits = new Map<TabId, ScreenDef & { tab: TabId }>();
function loadingScreen(t: TabId): ScreenDef & { tab: TabId } {
  let s = waits.get(t);
  if (!s) { s = { view: Loading, tab: t }; waits.set(t, s); }
  return s;
}

let keys = 0;
const entry = (id: string, params: Params = {}): Entry => ({ id, params, key: ++keys });

export const stack = signal<Entry[]>([entry('today')]);
export const top = computed(() => stack.value[stack.value.length - 1]);
/** The bar tab the stack started from (the one lit on the bar). */
export const barTab = computed(() => {
  const t = screen(stack.value[0].id)?.tab;
  return t === 'today' || t === 'chats' || t === 'orders' || t === 'customers' ? t : null;
});

/**
 * A screen by its id. A screen of a tab not loaded yet is its loading state, and the tab is
 * fetched; when it arrives the real screen takes its place (TABS is a signal).
 */
export function screen(id: string): (ScreenDef & { tab: TabId }) | undefined {
  const s = registry().get(id);
  if (s) return s;
  const t = tabOfId(id);
  if (!t || isLoaded(t)) return undefined;
  void loadTab(t).catch(() => undefined);
  return loadingScreen(t);
}

/** Whether the tab bar shows under the top screen. */
export const showTabBar = computed(() => {
  const s = screen(top.value.id);
  if (!s) return false;
  if (s.tabBar != null) return s.tabBar;
  // A tab's root is its own id (types.ts), loaded or not.
  return s.tab === top.value.id && stack.value.length === 1;
});

function check(id: string): void {
  if (!screen(id)) throw new Error(`No screen "${id}" (each tab registers its own in its index.tsx)`);
}

function setStack(next: Entry[], pushHistory: boolean): void {
  stack.value = next;
  if (typeof window !== 'undefined') {
    if (pushHistory) history.pushState({ depth: next.length }, '');
    window.scrollTo(0, 0);
  }
}

export const nav = {
  tab(t: TabId): void {
    const mod = TABS.value.find((x) => x.id === t);
    if (!mod && !tabOfId(t)) return;
    setStack([entry(mod ? mod.root : t)], false);
  },
  push(id: string, params: Params = {}): void {
    check(id);
    setStack([...stack.value, entry(id, params)], true);
  },
  replace(id: string, params: Params = {}): void {
    check(id);
    setStack([...stack.value.slice(0, -1), entry(id, params)], false);
  },
  /** Write the screen's own state into its params (the same screen stays, scrolled where it is), so Back lands on it: Chats' filter. */
  keep(params: Params): void {
    const cur = stack.value[stack.value.length - 1];
    if (cur) stack.value = [...stack.value.slice(0, -1), { ...cur, params: { ...cur.params, ...params } }];
  },
  back(): void {
    if (stack.value.length > 1) history.back();
  },
  home(): void {
    setStack([entry('today')], false);
  },
};

if (typeof window !== 'undefined') {
  history.replaceState({ depth: 1 }, '');
  window.addEventListener('popstate', () => {
    if (stack.value.length > 1) setStack(stack.value.slice(0, -1), false);
  });
}
