import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/index.js';
import { conversations, messages } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const anthropic = new Anthropic();

const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6';
const SYSTEM_PROMPT = 'You are Eolas, a personal AI assistant. Be helpful, concise, and direct.';

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { conversationId: string };
    Body: { content: string };
  }>('/conversations/:conversationId/messages', async (request, reply) => {
    const { conversationId } = request.params;
    const { content } = request.body;

    if (!content?.trim()) {
      return reply.code(400).send({ error: 'content is required' });
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      conversationId,
      role: 'user',
      content: encrypt(content),
      createdAt: new Date(),
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // SSE — take full control of the raw response
    reply.hijack();
    const raw = reply.raw;
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('Access-Control-Allow-Origin', request.headers['origin'] ?? '*');
    raw.setHeader('Access-Control-Allow-Credentials', 'true');
    raw.flushHeaders();

    function sendEvent(payload: Record<string, unknown>): void {
      raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    try {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 8096,
        system: SYSTEM_PROMPT,
        messages: history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: decrypt(m.content),
        })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          sendEvent({ type: 'delta', text: event.delta.text });
        }
      }

      const finalMsg = await stream.finalMessage();
      const assistantText =
        finalMsg.content[0]?.type === 'text' ? finalMsg.content[0].text : '';

      const assistantMessageId = randomUUID();
      const assistantCreatedAt = new Date();
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: encrypt(assistantText),
        createdAt: assistantCreatedAt,
      });

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      // If this is the first exchange, set the title to the user's first message
      const messageCount = history.length;
      if (messageCount === 1) {
        const title = content.trim().slice(0, 60);
        await db
          .update(conversations)
          .set({ title: encrypt(title) })
          .where(eq(conversations.id, conversationId));
      }

      sendEvent({
        type: 'done',
        userMessageId,
        assistantMessageId,
        assistantCreatedAt: assistantCreatedAt.toISOString(),
      });
    } catch {
      sendEvent({ type: 'error', message: 'Failed to get AI response' });
    }

    raw.end();
  });
}
