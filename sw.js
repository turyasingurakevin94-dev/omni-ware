// Service worker for the pick & pack push flow. Deliberately holds no
// business logic -- it only shows the notification and wakes/opens a tab,
// then hands off to index.html (via postMessage, or a ?orderId=&action=
// query string on cold start) which does the actual accept/deny/render work
// against the already-loaded `data` in memory.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* non-JSON push, ignore */ }
  const title = payload.title || 'Order to prepare';
  const options = {
    body: payload.body || '',
    tag: payload.orderId ? `order-${payload.orderId}` : undefined,
    data: { orderId: payload.orderId || null },
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'deny', title: 'Deny' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data && event.notification.data.orderId;
  const action = event.action || 'open';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = allClients[0];
    if (client) {
      client.focus();
      client.postMessage({ orderId, action });
    } else {
      await self.clients.openWindow(`/?orderId=${encodeURIComponent(orderId || '')}&action=${encodeURIComponent(action)}`);
    }
  })());
});
