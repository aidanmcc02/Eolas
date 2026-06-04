import webpush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { decrypt } from './crypto.js';

export function assertVapidKeys(): void {
  const pub = process.env['VAPID_PUBLIC_KEY'];
  const priv = process.env['VAPID_PRIVATE_KEY'];
  if (!pub || !priv) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set — refusing to start');
  }
  const subject = process.env['VAPID_SUBJECT'] ?? 'mailto:aidanmccarthy3@gmail.com';
  webpush.setVapidDetails(subject, pub, priv);
}

export async function sendPushToAll(title: string, body: string, url = '/'): Promise<void> {
  const subs = await db.select().from(pushSubscriptions);
  console.log(`[push] sending to ${subs.length} subscriber(s)`);
  const results = await Promise.allSettled(
    subs.map(async (row) => {
      const keys = JSON.parse(decrypt(row.keys)) as { p256dh: string; auth: string };
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys },
        JSON.stringify({ title, body, url }),
      );
    }),
  );
  for (const r of results) {
    if (r.status === 'rejected') console.error('[push] send failed:', r.reason);
  }
}
