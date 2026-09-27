/* The agent app's service worker. It does one job: show the notifications
   agent-nudge sends (supabase/functions/agent-nudge), and open the app on
   the Feed when one is tapped. It caches nothing -- the app has its own
   offline snapshot, and a second cache here would be a second copy of the
   truth to go stale. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (_e) { msg = { title: 'Omni-Ware', body: event.data ? event.data.text() : '' }; }
  const title = msg.title || 'Omni-Ware';
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || '',
    tag: msg.kind || 'feed',
    renotify: true,
    data: { url: msg.url || '/agent.html?open=feed' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/agent.html?open=feed';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.includes('/agent.html')) {
        await w.focus();
        w.postMessage({ type: 'open', tab: 'feed' });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
