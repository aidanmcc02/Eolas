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
  const tab = new URL(url, 'https://x').searchParams.get('tab');

  event.waitUntil(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self.clients as any).matchAll({ type: 'window', includeUncontrolled: true }).then((list: any[]) => {
      if (list.length > 0) {
        const client = list[0];
        if (tab) client.postMessage({ type: 'navigate-tab', tab });
        return client.focus();
      }
      return (self.clients as any).openWindow(url);
    }),
  );
});
