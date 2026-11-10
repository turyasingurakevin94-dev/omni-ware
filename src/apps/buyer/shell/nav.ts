/*
 * The Buyer's screen stack (spec 07: one stack per app, no router library).
 * Two tab roots, Today and Suppliers; the red + opens the trip.
 *
 *   nav.tab('suppliers')                 the stack becomes [its root]
 *   nav.push('orders/order', { id })     a screen on top
 *   nav.back()                           the one below (the phone's back does the same)
 *   nav.replace('trip/done')             swap the top (an end-of-flow screen)
 *   nav.home()                           "Back to Today"
 *
 * Screens register in screens.ts; an id names its folder: 'trip/plan' lives in trip/.
 */
import { computed, signal } from '@preact/signals';
import type { JSX } from 'preact';

export type Params = Record<string, string | number | boolean | null | undefined>;
export type Tab = 'today' | 'suppliers';
export interface ScreenDef { view: (p: { params: Params }) => JSX.Element; tabBar?: boolean }

let REG: Record<string, ScreenDef> = {};
/** The screens, given once by screens.ts (it imports the views; they import nav). */
export function register(r: Record<string, ScreenDef>): void { REG = r; }
export function screen(id: string): ScreenDef | undefined { return REG[id]; }

export interface Entry { id: string; params: Params; key: number }
let keys = 0;
const entry = (id: string, params: Params = {}): Entry => ({ id, params, key: ++keys });

export const stack = signal<Entry[]>([entry('today')]);
export const top = computed(() => stack.value[stack.value.length - 1]);
export const barTab = computed<Tab | null>(() => {
  const r = stack.value[0].id;
  return r === 'today' || r === 'suppliers' ? r : null;
});
/** The bar shows on a tab root, alone on the stack, unless the screen says otherwise. */
export const showTabBar = computed(() => {
  const s = screen(top.value.id);
  if (s && s.tabBar != null) return s.tabBar;
  return stack.value.length === 1 && (top.value.id === 'today' || top.value.id === 'suppliers');
});

function setStack(next: Entry[], pushHistory: boolean): void {
  stack.value = next;
  if (typeof window !== 'undefined') {
    if (pushHistory) history.pushState({ depth: next.length }, '');
    window.scrollTo(0, 0);
  }
}

export const nav = {
  tab(t: Tab): void { setStack([entry(t)], false); },
  push(id: string, params: Params = {}): void {
    if (!screen(id)) throw new Error(`No screen "${id}"`);
    setStack([...stack.value, entry(id, params)], true);
  },
  replace(id: string, params: Params = {}): void { setStack([...stack.value.slice(0, -1), entry(id, params)], false); },
  back(): void { if (stack.value.length > 1) history.back(); },
  home(): void { setStack([entry('today')], false); },
};

if (typeof window !== 'undefined') {
  history.replaceState({ depth: 1 }, '');
  window.addEventListener('popstate', () => {
    if (stack.value.length > 1) setStack(stack.value.slice(0, -1), false);
  });
}
