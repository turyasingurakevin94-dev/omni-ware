/*
 * A role's lazy files (docs/spec/07-stack.md §4, "per-tab loading"): the one loader the
 * apps share. tools/build-app.js builds each lazy folder of a role into its own file beside
 * the page (next/sales-orders.js, next/store-pack.js); that file calls window.owSalesTab
 * when it runs, with the build id it was made with. The page's own build id is
 * window.ow<Role>Build (owSalesBuild, owStoreBuild); a file of another build is refused.
 *
 *   fetchChunk('store', 'pack')     the file's exports, once it has run
 *   reloadOnce('store', err)        another build is on the server: reload the page, once
 *
 * Which ids a role loads, when, and what it does with them stay in its shell
 * (src/apps/sales/shell/tabs.ts, src/apps/store/shell/areas.ts).
 */
export type ChunkModule = Record<string, unknown>;

declare global {
  interface Window {
    /** Each lazy file calls this when it runs (the name is the build's, tools/build-app.js). */
    owSalesTab?: (id: string, mod: ChunkModule, build: string) => void;
  }
}

const waiting: Record<string, { ok: (m: ChunkModule) => void; fail: (e: Error) => void }> = {};
const pageBuild = (role: string): string | undefined =>
  (window as unknown as Record<string, string | undefined>)[`ow${role[0].toUpperCase()}${role.slice(1)}Build`];

if (typeof window !== 'undefined') {
  window.owSalesTab = (id, mod, build) => {
    const k = Object.keys(waiting).find((x) => x.endsWith(':' + id));
    const w = k ? waiting[k] : undefined;
    if (!k || !w) return;
    delete waiting[k];
    const want = pageBuild(k.split(':')[0]);
    if (want && build !== want) w.fail(new Error(`The ${id} file is from another build`));
    else w.ok(mod);
  };
}

/** The lazy file `<role>-<id>.js` beside the page, run; its exports. */
export function fetchChunk(role: string, id: string): Promise<ChunkModule> {
  return new Promise((ok, fail) => {
    const k = `${role}:${id}`;
    waiting[k] = { ok, fail };
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + `${role}-${id}.js`;
    el.onerror = () => { delete waiting[k]; el.remove(); fail(new Error(`The ${id} file did not load`)); };
    document.head.appendChild(el);
  });
}

/** Another build is on the server (or in the phone's copy): this page is out of date. Reload it, once. */
export function reloadOnce(role: string, e: Error): void {
  const key = `ow-${role}-reloaded`;
  try {
    if (/another build/.test(e.message) && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      location.reload();
    }
  } catch (_e) { /* no storage: stay */ }
}
