import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { encrypt } from '../lib/crypto.js';
import { sendPushToAll } from '../lib/push.js';

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.post('/push/subscribe', async (req, reply) => {
    const body = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return reply.code(400).send({ error: 'Invalid subscription payload' });
    }
    const encryptedKeys = encrypt(JSON.stringify(body.keys));
    await db
      .insert(pushSubscriptions)
      .values({ id: randomUUID(), endpoint: body.endpoint, keys: encryptedKeys })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { keys: encryptedKeys },
      });
    return { ok: true };
  });

  app.delete('/push/subscribe', async (req, reply) => {
    const body = req.body as { endpoint?: string };
    if (!body.endpoint) return reply.code(400).send({ error: 'Missing endpoint' });
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
    return { ok: true };
  });

  // Called by apps/agents to fan out a push notification to all subscribers
  app.post('/push/notify', async (req, reply) => {
    const body = req.body as { title?: string; body?: string; url?: string };
    if (!body.title || !body.body) return reply.code(400).send({ error: 'Missing title or body' });
    await sendPushToAll(body.title, body.body, body.url);
    return { ok: true };
  });
}
