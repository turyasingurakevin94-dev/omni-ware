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
  // Deliberately no action buttons here -- different Android versions/Chrome
  // builds/OEM notification skins don't reliably render actions in the
  // order they're declared, which let a tap on what looked like "Accept"
  // actually fire "deny" underneath. Tapping the notification now just
  // opens/focuses the app on this order; Accept/Deny are two unambiguous
  // in-app buttons instead (see renderWorkerPendingList in shared-worker.js).
  const options = {
    body: payload.body || '',
    tag: payload.orderId ? `order-${payload.orderId}` : undefined,
    data: { orderId: payload.orderId || null },
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
      // Cold start (no tab open at all): land on the standalone worker app,
      // since that's who these push notifications are for. A dual-role
      // admin+worker with a tab already open instead gets the postMessage
      // path above, which works the same in either app.
      await self.clients.openWindow(`/worker.html?orderId=${encodeURIComponent(orderId || '')}&action=${encodeURIComponent(action)}`);
    }
  })());
});
