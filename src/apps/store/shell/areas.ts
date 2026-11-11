/*
 * The Store's areas in their own files (docs/spec/07-stack.md §4, "per-tab loading", the
 * Sales way: src/apps/sales/shell/tabs.ts). The page ships the shell, src/ui, src/core and
 * Today; Pack, Goods in, Shelf and Out are each a file beside it (next/store-pack.js,
 * store-in.js, store-shelf.js, store-out.js, tools/build-app.js), loaded the first time one
 * of their screens opens, and all of them quietly after the first paint so they are on the
 * phone before the signal goes.
 *
 *   loadArea('pack')                          the area's screens, registered (once)
 *   callArea('in', 'openNotOnList', …)        a sheet another area exports (routes §4), its file loaded first
 *   preloadAreas()                            every area, one after another; then <html data-tabs>
 *
 * An area builder never edits this file: export screens from your area's index.tsx.
 */
import { signal } from '@preact/signals';
import { fetchChunk, reloadOnce, type ChunkModule } from '../../../core/chunks.ts';
import { addScreens, type ScreenDef } from './nav.ts';
import { route, type Area } from './routes.ts';

export type LazyArea = 'pack' | 'in' | 'shelf' | 'out';
/** In the order they are fetched after the first paint: the yard's run, then Shelf. */
export const LAZY: LazyArea[] = ['pack', 'out', 'in', 'shelf'];

/** The areas here now; a screen of one not here is its loading state (shell/Loading.tsx). */
export const loaded = signal<LazyArea[]>([]);
/** An area whose file would not load (no signal, not on the phone yet): its screen says so. */
export const failed = signal<LazyArea | null>(null);

const exportsOf: Partial<Record<LazyArea, ChunkModule>> = {};
const pending: Partial<Record<LazyArea, Promise<void>>> = {};

/** The lazy area a route id belongs to (routes.ts), or null for the shell and Today. */
export function areaOf(id: string): LazyArea | null {
  const a: Area | undefined = route(id)?.area;
  return a && (LAZY as string[]).includes(a) ? (a as LazyArea) : null;
}

export const isLoaded = (a: LazyArea): boolean => loaded.value.includes(a);

/** The area's file: from memory, else fetched and its screens registered (a failed load can be tried again). */
export function loadArea(a: LazyArea): Promise<void> {
  if (isLoaded(a)) return Promise.resolve();
  if (!pending[a]) {
    pending[a] = fetchChunk('store', a).then((mod) => {
      exportsOf[a] = mod;
      addScreens(mod.screens as Record<string, ScreenDef>);
      loaded.value = [...loaded.value, a];
      if (failed.value === a) failed.value = null;
    }, (e: Error) => {
      delete pending[a];
      failed.value = a;
      reloadOnce('store', e);
      throw e;
    });
  }
  return pending[a] as Promise<void>;
}

/** A function another area exports from its index.tsx (routes §4), its file loaded first. */
export function callArea(a: LazyArea, name: string, ...args: unknown[]): Promise<unknown> {
  return loadArea(a).then(() => {
    const fn = (exportsOf[a] || {})[name];
    if (typeof fn !== 'function') throw new Error(`The ${a} area exports no ${name}`);
    return (fn as (...x: unknown[]) => unknown)(...args);
  });
}

/** After the first paint: every area, one at a time. Marks <html data-tabs> (the parity tool waits on it). */
export function preloadAreas(): Promise<void> {
  return LAZY.reduce<Promise<void>>((p, a) => p.then(() => loadArea(a).then(() => undefined, () => undefined)), Promise.resolve())
    .then(() => { if (typeof document !== 'undefined') document.documentElement.dataset.tabs = LAZY.every(isLoaded) ? 'all' : 'some'; });
}
