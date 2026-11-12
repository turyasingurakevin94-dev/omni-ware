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
 *
 * The browser's (and an installed web app's) Back undoes one thing, as the phone's does (src/native/back.ts):
 * an open sheet has its own history entry, so Back closes the sheet and stays on the screen under it.
 * A second tap on a back button before the first lands pops one screen, not two.
 */
import { computed, effect, signal } from '@preact/signals';
import type { JSX } from 'preact';
import { sheet } from '../../../ui/sheet.tsx';

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

/** A back asked for that the browser has not done yet (a double tap pops one screen). */
let pending = 0, pendingTimer = 0;
/** A history entry stands for the open sheet. */
let sheetEntry = false;
/** Pops this file asked for itself (a sheet closed by a tap uses up its entry): not a Back. */
let ours = 0;

export const nav = {
  tab(t: Tab): void { setStack([entry(t)], false); },
  push(id: string, params: Params = {}): void {
    if (!screen(id)) throw new Error(`No screen "${id}"`);
    setStack([...stack.value, entry(id, params)], true);
  },
  replace(id: string, params: Params = {}): void { setStack([...stack.value.slice(0, -1), entry(id, params)], false); },
  back(): void {
    // One back at a time: a second tap before the browser has gone back is the same tap.
    if (pending || stack.value.length <= 1) return;
    pending++;
    history.back();
    // Never stuck: should the browser not go back, the next tap works.
    clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pending = 0; }, 1000);
  },
  home(): void { setStack([entry('today')], false); },
};

if (typeof window !== 'undefined') {
  history.replaceState({ depth: 1 }, '');
  effect(() => {
    const open = sheet.isOpen;
    if (open && !sheetEntry) { sheetEntry = true; history.pushState({ depth: stack.peek().length, sheet: true }, ''); }
    else if (!open && sheetEntry) { sheetEntry = false; ours++; history.back(); }
  });
  window.addEventListener('popstate', () => {
    if (ours) { ours--; return; }
    // Back with a sheet open closes it; a screen's own back asked for under a sheet goes on to pop.
    if (sheetEntry) { sheetEntry = false; sheet.close(); if (pending) history.back(); return; }
    if (pending) pending--;
    if (stack.value.length > 1) setStack(stack.value.slice(0, -1), false);
  });
}
