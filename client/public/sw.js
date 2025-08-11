// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/total-wins-icon.png',
      badge: data.badge || '/total-wins-badge.png',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: true,
      tag: data.data?.type || 'total-wins'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (data?.url) {
    url = data.url;
  } else if (event.action === 'view_draft') {
    url = data?.leagueId ? `/draft?league=${data.leagueId}` : '/draft';
  } else if (event.action === 'view_standings') {
    url = data?.leagueId ? `/standings?league=${data.leagueId}` : '/standings';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url.includes(url.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if app isn't open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Track notification dismissal if needed
  console.log('Notification closed:', event.notification.tag);
});