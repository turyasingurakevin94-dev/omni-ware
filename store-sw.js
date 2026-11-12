/* The old Store app's service worker, retired (the Store switched 2026-11-12,
   docs/rebuild.md). store.html is now the new Store app, built from
   src/apps/store, and it registers no service worker. Phones that opened the
   old page still have the old worker on /store.html: a browser checks this
   file when it opens that page, finds this one, and it takes itself off.

   - It answers nothing (no fetch handler): the page and its area files come
     from the network, all of one build.
   - It drops the old page's kept copy and its old caches, then unregisters.
     ow-store-v2 itself stays: old/store.html's own worker (old/store-sw.js,
     until 2026-12-12) keeps its copy there under /old/store.html.

   Goes with the old page (the retire list). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const k of await caches.keys()) {
    if (k.startsWith('ow-store-') && k !== 'ow-store-v2') await caches.delete(k);
  }
  if (await caches.has('ow-store-v2')) {
    const c = await caches.open('ow-store-v2');
    await c.delete('/store.html');
  }
  await self.registration.unregister();
})()));
