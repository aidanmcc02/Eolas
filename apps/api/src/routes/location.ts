import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { userLocation } from '../db/schema.js';

const LOCATION_ID = 'default';

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/location', async (req, reply) => {
    const body = req.body as { lat?: number; lon?: number; label?: string };
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number') {
      return reply.code(400).send({ error: 'lat and lon required' });
    }
    await db
      .insert(userLocation)
      .values({ id: LOCATION_ID, lat: body.lat, lon: body.lon, label: body.label ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userLocation.id,
        set: { lat: body.lat, lon: body.lon, label: body.label ?? null, updatedAt: new Date() },
      });
    return { ok: true };
  });

  app.get('/location', async (_req, reply) => {
    const rows = await db.select().from(userLocation).limit(1);
    if (rows.length === 0) return reply.code(404).send({ error: 'No location saved' });
    const row = rows[0]!;
    return { lat: row.lat, lon: row.lon, label: row.label };
  });
}
