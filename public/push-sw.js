self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'GridLead';
  const options = {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
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
