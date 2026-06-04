// SQLite finance DB via @tauri-apps/plugin-sql.
// Only called when isTauri === true. Never imported server-side.

import type { Transaction } from './types';

type DbRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  import_date: string;
  saved: number;
};

const DB_PATH = 'sqlite:finance.db';

async function getDb() {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  return Database.load(DB_PATH);
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      category TEXT NOT NULL DEFAULT 'Other',
      import_date TEXT NOT NULL,
      saved INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);

  // Migration: add saved column to DBs that pre-date this column
  try {
    await db.execute(`ALTER TABLE transactions ADD COLUMN saved INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — safe to ignore
  }
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDb();
  for (const t of transactions) {
    await db.execute(
      `INSERT OR REPLACE INTO transactions (id, date, description, amount, currency, category, import_date, saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [t.id, t.date, t.description, t.amount, t.currency, t.category, t.importDate]
    );
  }
}

export async function loadTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.select<DbRow[]>('SELECT * FROM transactions ORDER BY date DESC');
  return rows.map(rowToTransaction);
}

export async function updateCategories(categoryMap: Map<string, string>): Promise<void> {
  const db = await getDb();
  for (const [description, category] of categoryMap) {
    await db.execute('UPDATE transactions SET category = ? WHERE description = ?', [category, description]);
  }
}

// Mark all transactions in a specific month (YYYY-MM) as saved.
export async function markMonthSaved(month: string): Promise<number> {
  const db = await getDb();
  await db.execute(
    `UPDATE transactions SET saved = 1 WHERE strftime('%Y-%m', date) = ?`,
    [month]
  );
  const rows = await db.select<[{ n: number }]>(
    `SELECT COUNT(*) as n FROM transactions WHERE saved = 1 AND strftime('%Y-%m', date) = ?`,
    [month]
  );
  return rows[0]?.n ?? 0;
}

// Delete ALL unsaved transactions across all months.
export async function clearAllUnsaved(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM transactions WHERE saved = 0`);
}

// Wipe everything including saved data.
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM transactions');
}

function rowToTransaction(row: DbRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: 'EUR',
    category: row.category,
    importDate: row.import_date,
    saved: row.saved === 1,
  };
}
