import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL env var is not set');

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  // From dist/db/migrate.js, go two levels up to reach the drizzle/ folder at app root
  const migrationsFolder = join(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
  await sql.end();
}
