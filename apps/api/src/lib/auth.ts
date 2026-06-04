import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ownerKey = process.env['API_KEY'];
  if (!ownerKey) {
    reply.code(500).send({ error: 'API_KEY env var is not configured' });
    return;
  }

  const auth = request.headers['authorization'];
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  const guestKey = process.env['GUEST_API_KEY'];
  const valid = provided === ownerKey || (!!guestKey && provided === guestKey);

  if (!valid) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function isGuestRequest(request: FastifyRequest): boolean {
  const guestKey = process.env['GUEST_API_KEY'];
  if (!guestKey) return false;
  const auth = request.headers['authorization'];
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  return provided === guestKey;
}
