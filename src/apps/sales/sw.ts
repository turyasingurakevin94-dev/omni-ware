/*
 * The Sales service worker (docs/spec/06-offline-sync-push.md Q14, spec 07 §4
 * "per-tab loading"). One job: the app opens and every tab works with no
 * signal, from this phone.
 *
 * - This build's files (the page and each tab's file, listed by the build:
 *   __OW_FILES__) are put on the phone when the worker installs, in one cache
 *   named for the build, and answered from it. The page and its tabs always
 *   come from the same build: a tab file of another build would not fit the
 *   page that loads it.
 * - A new build is a new worker (its build id is in this file). It installs
 *   behind the open app and takes over only when every Sales window is
 *   closed (no skipWaiting), so a page never meets another build's tab file;
 *   the next open is the new build, whole. Its activate drops the old cache.
 * - supabase-js (pinned), the fonts and the manifest are kept when first
 *   fetched. The shop's data is never touched here: Supabase goes straight
 *   to the network; the books on the phone are the app's own (IndexedDB).
 *
 * - A tapped notification (spec 06 Q8) opens its page: an open Sales
 *   window is focused and posted the push (it opens the page from the
 *   phone's copy, no reload); with none, the page opens at
 *   #push=<kind>&… (shell/open-push.ts).
 *
 * Built by tools/build-app.js into next/sales-sw.js, beside the page.
 */
import { pushQuery, type PushData } from './shell/pushes.ts';

declare const __OW_BUILD__: string;
declare const __OW_FILES__: string[];

interface SwEvent extends Event { waitUntil(p: Promise<unknown>): void }
interface FetchEv extends SwEvent { request: Request; respondWith(r: Promise<Response> | Response): void }
interface Win { url: string; focus(): Promise<unknown>; postMessage(m: unknown): void }
interface ClickEv extends SwEvent { notification: { data?: unknown; close(): void } }
interface Sw {
  location: Location;
  registration: { scope: string };
  clients: {
    claim(): Promise<void>;
    matchAll(o: { type: 'window'; includeUncontrolled: boolean }): Promise<Win[]>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(type: 'install' | 'activate', fn: (e: SwEvent) => void): void;
  addEventListener(type: 'fetch', fn: (e: FetchEv) => void): void;
  addEventListener(type: 'notificationclick', fn: (e: ClickEv) => void): void;
}

const sw = self as unknown as Sw;
const CACHE = 'ow-sales-' + __OW_BUILD__;
const urlOf = (f: string): string => new URL(f, sw.registration.scope).href;
const MINE = new Set(__OW_FILES__.map((f) => new URL(f, sw.registration.scope).pathname));

sw.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(__OW_FILES__.map((f) => new Request(urlOf(f), { cache: 'no-cache' })))));
});

sw.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ow-sales-') && k !== CACHE && k !== 'ow-sales-libs') await caches.delete(k);
  await sw.clients.claim();
})()));

function isLib(url: URL): boolean {
  return (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@'))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
    || (url.origin === sw.location.origin && url.pathname === '/manifest-sales.json');
}

/** This build's page or tab file: from the phone; from the network only if it is somehow not there. */
async function mine(req: Request, path: string): Promise<Response> {
  const c = await caches.open(CACHE);
  const hit = await c.match(urlOf(path.split('/').pop() as string));
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && req.method === 'GET' && !new URL(req.url).search) await c.put(req, res.clone());
  return res;
}

async function lib(req: Request): Promise<Response> {
  const c = await caches.open('ow-sales-libs');
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => undefined);
  return res;
}

sw.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)supabase\.co$/.test(url.hostname)) return;
  if (url.origin === sw.location.origin && MINE.has(url.pathname)) e.respondWith(mine(req, url.pathname));
  else if (isLib(url)) e.respondWith(lib(req));
});

/** A notification's push data: as the page showed it, or as FCM's web SDK wraps it (FCM_MSG.data). */
function pushOf(raw: unknown): PushData {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fcm = o.FCM_MSG as { data?: unknown } | undefined;
  const d = (fcm && fcm.data && typeof fcm.data === 'object' ? fcm.data : o) as Record<string, unknown>;
  const out: PushData = {};
  Object.keys(d).forEach((k) => { if (d[k] != null && typeof d[k] !== 'object') out[k] = String(d[k]); });
  return out;
}

sw.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = pushOf(e.notification.data), page = urlOf(__OW_FILES__[0]), path = new URL(page).pathname;
  e.waitUntil((async () => {
    const open = (await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((c) => new URL(c.url).pathname === path);
    if (open.length) {
      if (d.kind) open[0].postMessage({ owPush: d });
      await open[0].focus();
    } else {
      await sw.clients.openWindow(d.kind ? `${page}#${pushQuery(d)}` : page);
    }
  })());
});
