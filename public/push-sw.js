// Ensure new service worker takes control immediately so clients receive postMessage
self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
    } catch (e) {
      console.warn('[push-sw] clients.claim failed', e?.message || e);
    }
  })());
});

self.addEventListener('push', (event) => {
  try {
    const data = event.data?.json ? event.data.json() : {};
    console.log('[push-sw] push event received', data);
    const title = (data && data.title) || 'GridLead';
    const options = {
      body: (data && data.body) || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: (data && data.url) || '/',
      // During testing, requireInteraction keeps the notification visible until dismissed.
      // Remove or set to false for production.
      requireInteraction: true,
      tag: 'gridlead-push',
      renotify: true,
    };
    // Use a single async task for showNotification + client.postMessage so we can
    // await inside it and pass the promise to event.waitUntil.
    event.waitUntil((async () => {
      await self.registration.showNotification(title, options);
      try {
        const clientsArr = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of clientsArr) {
          client.postMessage({ type: 'push:received', payload: data || {} });
        }
      } catch (pmErr) {
        console.warn('[push-sw] failed to postMessage to clients', pmErr?.message || pmErr);
      }
    })());
  } catch (e) {
    console.error('[push-sw] error handling push', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[push-sw] notification click', event.notification && event.notification.data);
  event.notification.close();
  const target = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const hadWindow = clientsArr.some((client) => {
        if (client.url === target) {
          client.focus();
          return true;
        }
        return false;
      });
      if (!hadWindow) {
        return self.clients.openWindow(target);
      }
    })
  );
});
