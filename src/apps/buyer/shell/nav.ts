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
 *
 * The history (BUY-01): one entry per screen on the stack and one more while a sheet is open, under them a
 * guard, so Back on Today stays in the app. Entry k is the screen at depth k, so the history is never walked
 * blind: after any change it is brought to the stack (`fit`), reading `history.state`.
 *   a sheet opens               its entry is pushed
 *   a sheet gives way to        a screen: the sheet's entry becomes the screen's (replaceState);
 *                               another sheet: the entry stays
 *   a sheet closes by a tap     its entry is popped, only if it is on top
 *   Back on Today               lands on the guard: Today's entry comes back, the app stays
 * While a back is on its way nothing else is written; the landing brings the history up to date.
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

function setStack(next: Entry[]): void {
  stack.value = next;
  if (typeof window !== 'undefined') window.scrollTo(0, 0);
}

/** What a history entry of this app holds: its screen's depth (0 = the guard), the screen, a sheet over it. */
export interface Mark { ow: 1; depth: number; id: string; sheet: boolean }
const mark = (depth: number, onTop = false): Mark => ({ ow: 1, depth, id: depth ? stack.peek()[depth - 1].id : 'guard', sheet: onTop });
const here = (): Mark | null => {
  const s = history.state as Mark | null;
  return s && s.ow === 1 ? s : null;
};

/** A back asked for that the browser has not done yet (a double tap pops one screen). */
let pending = 0, pendingTimer = 0;
/** Backs this file asked for itself (a sheet closed by a tap uses up its entry): not a Back. */
let ours = 0, oursTimer = 0;

function go(n: number, own: boolean): void {
  if (n <= 0) return;
  if (own) ours++; else pending++;
  history.go(-n);
  // Never stuck: should the browser not go back, the next change or tap works.
  const t = window.setTimeout(() => { if (own) ours = 0; else pending = 0; fit(); }, 1000);
  if (own) { clearTimeout(oursTimer); oursTimer = t; } else { clearTimeout(pendingTimer); pendingTimer = t; }
}

/** Bring the history to the stack and the sheet: push, replace or pop, never below the guard. */
function fit(): void {
  if (ours || pending) return;
  const want = stack.peek().length, open = sheet.isOpen, at = here();
  if (!at) { history.replaceState(mark(want), ''); if (open) history.pushState(mark(want, true), ''); return; }
  if (at.depth > want) { go(at.depth + (at.sheet ? 1 : 0) - want, true); return; }
  if (at.depth === want) {
    if (at.sheet && !open) { go(1, true); return; }
    if (at.id !== mark(want).id) history.replaceState(mark(want, at.sheet), '');
    if (open && !at.sheet) history.pushState(mark(want, true), '');
    return;
  }
  // Deeper: a sheet's entry gives way to the first new screen; the rest are pushed.
  let d = at.depth;
  if (at.sheet) history.replaceState(mark(++d), '');
  while (d < want) history.pushState(mark(++d), '');
  if (open) history.pushState(mark(want, true), '');
}

let queued = false;
function later(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; fit(); });
}

export const nav = {
  tab(t: Tab): void { setStack([entry(t)]); },
  push(id: string, params: Params = {}): void {
    if (!screen(id)) throw new Error(`No screen "${id}"`);
    setStack([...stack.value, entry(id, params)]);
  },
  replace(id: string, params: Params = {}): void { setStack([...stack.value.slice(0, -1), entry(id, params)]); },
  back(): void {
    // One back at a time: a second tap before the browser has gone back is the same tap. Never below the root.
    if (pending || stack.value.length <= 1) return;
    const at = here();
    if (sheet.isOpen) sheet.close();
    if (!at || ours) { setStack(stack.value.slice(0, -1)); return; }
    go(at.depth + (at.sheet ? 1 : 0) - (stack.value.length - 1), false);
  },
  home(): void { setStack([entry('today')]); },
};

if (typeof window !== 'undefined') {
  // Opened afresh: the guard, then Today. Reloaded deeper: this entry becomes Today's; the ones below heal on Back.
  const at = here();
  if (at && at.depth >= 1) history.replaceState(mark(1), '');
  else { history.replaceState(mark(0), ''); history.pushState(mark(1), ''); }
  effect(() => { void stack.value; void sheet.isOpen; later(); });
  window.addEventListener('popstate', () => {
    if (ours) { ours--; fit(); return; }
    const mine = pending > 0;
    if (pending) pending--;
    const s = here();
    if (!s) { fit(); return; }
    // The phone's Back (not a screen's own back button) closes an open sheet.
    if (!mine && sheet.isOpen && !s.sheet) sheet.close();
    const d = Math.max(1, s.depth);
    if (stack.value.length > d) setStack(stack.value.slice(0, d));
    fit();
  });
}
