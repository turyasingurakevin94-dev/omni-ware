/* The supplier app's service worker. One job: show a notification the
   shop sends (an order to confirm, a pickup, a payment) and open the app
   on the right screen when it is tapped. It caches nothing -- the app
   keeps its own small offline queue, and a second cache here would be a
   second copy of the truth to go stale. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (_e) { msg = { title: 'Omni-Ware', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'Omni-Ware', {
    body: msg.body || '',
    tag: msg.kind || 'supplier',
    renotify: true,
    data: { url: msg.url || '/supplier.html' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/supplier.html';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.includes('/supplier.html')) {
        await w.focus();
        w.postMessage({ type: 'open', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
