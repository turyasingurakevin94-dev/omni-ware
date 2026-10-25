/* The Store app's service worker (audit round 9, STO-SPD-01). One job: the
   page opens with no signal, from this phone.

   - store.html is answered from this phone at once and fetched again behind
     it. When the fresh copy differs, the app is told, and says "Update ready
     · Reload". The next open uses the new copy either way.
   - supabase.js (a pinned version), the fonts and the manifest are kept the
     first time they are fetched, and answered from this phone after that.
   - The shop's data is never touched here: requests to Supabase go straight
     to the network, and the copy the app keeps in IndexedDB stays the one
     copy of the books on this phone.

   To take this worker off every phone, publish a store-sw.js whose activate
   step unregisters itself. */
const PAGE = '/store.html';
// One cache for the page and its libraries (round 10, STO-UI-12); activate deletes every
// other ow-store-* cache, the two v1 caches included.
const CACHE = 'ow-store-v2';
let ready = false;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(PAGE, { cache: 'no-cache' }))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ow-store-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

function isPage(url, req) { return url.origin === self.location.origin && (url.pathname === PAGE || url.pathname === '/store') && req.mode === 'navigate'; }
function isLib(url) {
  return (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@'))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
    || (url.origin === self.location.origin && url.pathname === '/manifest-store.json');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)supabase\.co$/.test(url.hostname)) return;
  if (isPage(url, req)) event.respondWith(page(event));
  else if (isLib(url)) event.respondWith(lib(req));
});

async function tell() {
  ready = true;
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  wins.filter((w) => new URL(w.url).pathname === PAGE).forEach((w) => w.postMessage({ type: 'update' }));
}

async function page(event) {
  ready = false;
  const cache = await caches.open(CACHE);
  const had = await cache.match(PAGE);
  // Read the kept copy before it is handed to the page, which uses up its body.
  const oldText = had ? had.clone().text() : Promise.resolve(null);
  const fresh = fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(async (res) => {
    if (!res || !res.ok || res.type !== 'basic') return res;
    const body = await res.clone().text();
    const old = await oldText;
    await cache.put(PAGE, res.clone());
    if (old != null && old !== body) await tell();
    return res;
  });
  if (had) { event.waitUntil(fresh.catch(() => {})); return had; }
  try { return await fresh; } catch (e) { return (await cache.match(PAGE)) || Response.error(); }
}

async function lib(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

// The app asks once it is listening, in case the news came before it was.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ask' && ready && event.source) event.source.postMessage({ type: 'update' });
});
