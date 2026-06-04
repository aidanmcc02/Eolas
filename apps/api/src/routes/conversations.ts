import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { conversations, messages } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { isGuestRequest } from '../lib/auth.js';

export async function conversationsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/conversations', async (request, reply) => {
    const id = randomUUID();
    const now = new Date();
    await db.insert(conversations).values({
      id,
      title: encrypt('New conversation'),
      createdAt: now,
      updatedAt: now,
    });
    return reply.code(201).send({
      id,
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
    });
  });

  app.get('/conversations', async (request, reply) => {
    // Guests don't see the owner's conversation history
    if (isGuestRequest(request)) return reply.send([]);

    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    return reply.send(
      rows.map((c) => ({
        ...c,
        title: decrypt(c.title),
      })),
    );
  });

  app.get<{ Params: { id: string } }>('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' });

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    return reply.send(
      rows.map((m) => ({
        ...m,
        content: decrypt(m.content),
      })),
    );
  });
}
