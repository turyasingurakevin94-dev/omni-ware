/*
 * The native layer: a new app's page inside its Android app (apps/<role>). It moved here from the old
 * sales.html at the Sales switch (spec 07 §4, §5) and is shared by every new app, so a fix to it
 * reaches installed phones the way any change to the page does: through the live update below.
 *
 * Inert in a browser and in the demo. In the app it does four jobs:
 *   1. Back: a sheet, then a screen, then Today, and only then the background (back.ts).
 *   2. The strip over the status bar takes the colour of what is under it (bars.ts).
 *   3. The bars' size: none when Android lays the page out inside its bars, and a stand-in when
 *      Capacitor has not measured this page yet (bars.ts barsPlan).
 *   4. Staying current: the app's live page, when it is a build of this app, with its files from
 *      beside it; switched to when the app next goes to the background (update.ts).
 *
 * Each app wires it in its shell/native.ts: its NativeApp (page, key, build id) and its Back.
 * The first Sales installs carried the old layer as their own native.js, running beside the page;
 * there it already does Back and the update, and only the bars are left to this one.
 */
import { pressBack, type BackUi } from './back.ts';
import { fixInsets, startStrip } from './bars.ts';
import { updater, type NativeApp, type UpdateState } from './update.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Plugin = any;
interface Cap { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, Plugin> }

declare global {
  interface Window { owAppTransform?: (html: string) => string }
}

/** The Capacitor bridge when this page runs inside the phone app, else null. */
export function inPhoneApp(): Cap | null {
  const C = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return C && typeof C.isNativePlatform === 'function' && C.isNativePlatform() ? C : null;
}


function base64(blob: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1] || '');
    fr.onerror = () => fail(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function sha256(text: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.prototype.map.call(new Uint8Array(b), (x: number) => ('0' + x.toString(16)).slice(-2)).join('');
}

function header(h: Record<string, string> | undefined, name: string): string {
  const k = Object.keys(h || {}).find((x) => x.toLowerCase() === name);
  return k && h ? h[k] : '';
}

/** Job 4, on the plugins. */
function startUpdates(app: NativeApp, P: Record<string, Plugin>): void {
  const { check, settle, KEY } = updater(app);
  const { App, WebView, CapacitorHttp: Http, Filesystem: FS } = P;
  if (!(WebView && Http && FS && App && window.crypto && crypto.subtle && window.owAppTransform)) return;
  const transform = window.owAppTransform;
  const loadState = (): UpdateState => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_e) { return {}; } };
  const saveState = (s: UpdateState): void => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_e) { /* checked again next time */ } };
  const io = {
    load: loadState,
    save: saveState,
    now: () => Date.now(),
    running: () => fetch('bundle.json', { cache: 'no-store' }).then((r) => r.json()),
    runningNames: () => ((document.querySelector('meta[name="ow-files"]') as HTMLMetaElement | null)?.content || '').split(/\s+/).filter(Boolean),
    get: async (url: string, etag?: string) => {
      const r = await Http.request({ url, method: 'GET', responseType: 'text', headers: etag ? { 'If-None-Match': etag } : {} });
      return { status: r.status, text: typeof r.data === 'string' ? r.data : '', etag: header(r.headers, 'etag') };
    },
    local: async (f: string) => {
      const r = await fetch(f, { cache: 'no-store' });
      if (!r.ok) throw new Error(f + ': ' + r.status);
      return base64(await r.blob());
    },
    sha256,
    transform,
    write: (path: string, data: string, utf8: boolean) => FS.writeFile({ path, data, directory: 'DATA', recursive: true, ...(utf8 ? { encoding: 'utf8' } : {}) }).then(() => undefined),
    uri: (dir: string) => FS.getUri({ path: dir, directory: 'DATA' }).then((u: { uri: string }) => u.uri),
    remove: (dir: string) => FS.rmdir({ path: dir, directory: 'DATA', recursive: true }).then(() => undefined),
  };
  const settling = {
    load: loadState,
    save: saveState,
    basePath: () => WebView.getServerBasePath().then((c: { path?: string } | null) => (c && c.path) || ''),
    persist: () => WebView.persistServerBasePath(),
    dirs: () => FS.readdir({ path: 'live', directory: 'DATA' }).then((r: { files?: (string | { name: string })[] }) => (r.files || []).map((f) => (typeof f === 'string' ? f : f.name))),
    remove: io.remove,
  };
  // Never in the middle of an order: the new copy takes over when the app goes to the background.
  App.addListener('pause', () => {
    const s = loadState();
    if (s.staged) WebView.setServerBasePath({ path: s.staged.path }).catch(() => undefined);
  });
  App.addListener('resume', () => { void check(io); });
  settle(settling).catch(() => undefined).then(() => { setTimeout(() => { void check(io); }, 5000); });
}

/** What one app gives the layer: its update, whether it is the demo, and what Back sees on its stack. */
export interface NativeHost {
  app: NativeApp;
  isDemo: boolean;
  back(): Omit<BackUi, 'background'>;
}

/** Start the native layer. Does nothing in a browser or in the demo. */
export function startNative(h: NativeHost): void {
  const C = inPhoneApp();
  if (!C || h.isDemo) return;
  const P = C.Plugins || {};
  const legacy = !!document.querySelector('script[src="native.js"]');
  // The marker apps/<role>/scripts/build-www.js looks for: the page the app ships carries this layer.
  document.documentElement.setAttribute('data-ow-native', h.app.role);

  /* 1. Back */
  if (P.App && !legacy) {
    P.App.addListener('backButton', () => {
      pressBack({ ...h.back(), background: () => { P.App.minimizeApp().catch(() => undefined); } });
    });
  }

  /* 2 and 3. The bars */
  const android = typeof C.getPlatform !== 'function' || C.getPlatform() === 'android';
  const insets = () => { if (android) fixInsets(); };
  insets();
  setTimeout(insets, 800);
  setTimeout(insets, 2500);
  window.addEventListener('resize', () => setTimeout(insets, 300));
  if (P.App) P.App.addListener('resume', () => setTimeout(insets, 300));
  // Capacitor writes its measurement onto the root's style whenever it has one: decide again then.
  new MutationObserver(() => setTimeout(insets, 0)).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  if (!legacy) startStrip(P.SystemBars || null);

  /* 4. Staying current */
  if (!legacy) startUpdates(h.app, P);
}
