import Fastify from 'fastify';
import cors from '@fastify/cors';
import { assertEncryptionKey } from './lib/crypto.js';
import { assertVapidKeys } from './lib/push.js';
import { runMigrations } from './db/migrate.js';
import { requireApiKey } from './lib/auth.js';
import { conversationsRoutes } from './routes/conversations.js';
import { messagesRoutes } from './routes/messages.js';
import { pushRoutes } from './routes/push.js';
import { weatherRoutes } from './routes/weather.js';

assertEncryptionKey();
assertVapidKeys();
await runMigrations();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

app.get('/health', async () => ({ ok: true }));

// All /v1 routes require a valid API key
await app.register(async (api) => {
  api.addHook('preHandler', requireApiKey);
  await api.register(conversationsRoutes, { prefix: '/v1' });
  await api.register(messagesRoutes, { prefix: '/v1' });
  await api.register(pushRoutes, { prefix: '/v1' });
  await api.register(weatherRoutes, { prefix: '/v1' });
});

const port = Number(process.env['PORT'] ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
