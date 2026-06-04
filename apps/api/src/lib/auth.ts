import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env['API_KEY'];
  if (!expected) {
    reply.code(500).send({ error: 'API_KEY env var is not configured' });
    return;
  }
  const auth = request.headers['authorization'];
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== expected) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
