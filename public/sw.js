// Service Worker for Browser Push Notifications
// Placed in /public/sw.js — Next.js will serve it from root

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Grievance Update';
    const options = {
        body: data.body || 'Your complaint status has been updated.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'grievance-update',
        data: { url: data.url || '/track' },
        actions: [
            { action: 'track', title: '🔍 Track Status' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        requireInteraction: false,
        silent: false,
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'track' || event.action === '') {
        const url = event.notification.data?.url || '/track';
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then((clients) => {
                for (const client of clients) {
                    if (client.url.includes(url) && 'focus' in client) return client.focus();
                }
                if (self.clients.openWindow) return self.clients.openWindow(url);
            })
        );
    }
});
