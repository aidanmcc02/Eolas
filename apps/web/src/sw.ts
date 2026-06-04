import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST ?? []);

self.addEventListener('push', (event) => {
  const data = event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
  const title = data?.title ?? 'Eolas';
  const body = data?.body ?? '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      data: { url: data?.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil((self.clients as any).openWindow(url));
});
