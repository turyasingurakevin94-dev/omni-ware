/*
 * The six tab modules (docs/spec/07-stack.md §4, "per-tab loading"). The
 * page ships the shell, src/ui, src/core and the Today tab. Chats, Sell,
 * Counter, Orders and Customers are each their own built file beside the
 * page (next/sales-<tab>.js, tools/build-app.js), loaded the first time
 * one of their screens opens, and all of them quietly after the first paint
 * so they are on the phone before the signal goes.
 *
 *   loadTab('orders')                         the tab's module (loaded once, kept)
 *   callTab('orders', 'openTwice', 552)       a tab's exported sheet (ROUTES.md), loading it first
 *   preloadTabs()                             every tab, one after another, quietly
 *
 * A tab builder never edits this file: register screens in your tab's
 * index.tsx; reach another tab only by a ROUTES.md id or callTab.
 */
import { signal } from '@preact/signals';
import { tab as today } from '../today/index.tsx';
import type { TabId, TabModule } from './types.ts';

/** The tabs in their own files, in the order they are fetched after the first paint. */
export const LAZY: TabId[] = ['sell', 'orders', 'customers', 'chats', 'counter'];

/** The tabs here now (Today from the start). The registry in nav.ts follows it. */
export const TABS = signal<TabModule[]>([today]);
/** A tab whose file would not load (no signal and not on the phone yet): its screen says so. */
export const failed = signal<TabId | null>(null);

const exportsOf: Partial<Record<TabId, Record<string, unknown>>> = {};
const pending: Partial<Record<TabId, Promise<TabModule>>> = {};
const waiting: Partial<Record<TabId, { ok: (m: Record<string, unknown>) => void; fail: (e: Error) => void }>> = {};

declare global {
  interface Window {
    /** Set by the build (tools/build-app.js): which build this page is; a tab file of another build is refused. */
    owSalesBuild?: string;
    /** Each tab file calls this when it runs. */
    owSalesTab?: (id: TabId, mod: Record<string, unknown>, build: string) => void;
  }
}

if (typeof window !== 'undefined') {
  window.owSalesTab = (id, mod, build) => {
    const w = waiting[id];
    if (!w) return;
    delete waiting[id];
    if (window.owSalesBuild && build !== window.owSalesBuild) w.fail(new Error(`The ${id} file is from another build`));
    else w.ok(mod);
  };
}

/** The tab a screen id belongs to: ids are "<tab>" or "<tab>/…" (ROUTES.md). */
export function tabOfId(id: string): TabId | null {
  const t = id.split('/')[0] as TabId;
  return t === 'today' || LAZY.includes(t) ? t : null;
}

export function isLoaded(id: TabId): boolean {
  return TABS.value.some((m) => m.id === id);
}

function fetchTab(id: TabId): Promise<Record<string, unknown>> {
  return new Promise((ok, fail) => {
    waiting[id] = { ok, fail };
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + `sales-${id}.js`;
    el.onerror = () => { delete waiting[id]; el.remove(); fail(new Error(`The ${id} tab did not load`)); };
    document.head.appendChild(el);
  });
}

/** The tab's module: from memory, else its file (once; a failed load can be tried again). */
export function loadTab(id: TabId): Promise<TabModule> {
  const here = TABS.value.find((m) => m.id === id);
  if (here) return Promise.resolve(here);
  if (!pending[id]) {
    pending[id] = fetchTab(id).then((mod) => {
      const m = mod.tab as TabModule;
      exportsOf[id] = mod;
      TABS.value = [...TABS.value, m];
      if (failed.value === id) failed.value = null;
      return m;
    }, (e: Error) => {
      delete pending[id];
      failed.value = id;
      // Another build is on the server (or in the phone's copy): this page is out of date.
      if (/another build/.test(e.message) && !sessionStorage.getItem('ow-sales-reloaded')) {
        sessionStorage.setItem('ow-sales-reloaded', '1');
        location.reload();
      }
      throw e;
    });
  }
  return pending[id] as Promise<TabModule>;
}

/** A function another tab exports from its index.tsx (ROUTES.md "Exported sheets"), its tab loaded first. */
export function callTab(id: TabId, name: string, ...args: unknown[]): Promise<unknown> {
  return loadTab(id).then(() => {
    const fn = (exportsOf[id] || {})[name];
    if (typeof fn !== 'function') throw new Error(`The ${id} tab exports no ${name}`);
    return (fn as (...a: unknown[]) => unknown)(...args);
  });
}

/** After the first paint: every tab, one at a time, so they are on the phone before the signal goes. */
export function preloadTabs(): Promise<void> {
  return LAZY.reduce<Promise<void>>((p, id) => p.then(() => loadTab(id).then(() => undefined, () => undefined)), Promise.resolve())
    .then(() => { if (typeof document !== 'undefined') document.documentElement.dataset.tabs = LAZY.every(isLoaded) ? 'all' : 'some'; });
}
