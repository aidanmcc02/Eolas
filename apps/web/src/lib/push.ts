const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
const VAPID_PUBLIC_KEY = import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined;

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

// Returns true if push is supported but permission hasn't been asked yet.
// Used to decide whether to show the one-time prompt banner.
export function needsPushPrompt(): boolean {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  return Notification.permission === 'default';
}

// Must be called from a user gesture (tap) on iOS.
export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // Request permission first — must happen in the user gesture call stack on iOS.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  if (!VAPID_PUBLIC_KEY) return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const apiKey = localStorage.getItem('eolas_api_key') ?? '';

  await fetch(`${BASE_URL}/v1/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(json),
  }).catch(() => {});
}
