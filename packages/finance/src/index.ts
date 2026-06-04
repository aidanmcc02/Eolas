// Finance analysis — LOCAL ONLY.
// This package must never be imported by apps/api or apps/agents.
// All LLM inference goes to Ollama at http://localhost:11434.
// No financial data leaves the local machine.

export type Transaction = {
  date: Date;
  description: string;
  amount: number;
  currency: 'EUR';
  category?: string;
};

export type MonthSummary = {
  month: string; // YYYY-MM
  totalSpend: number;
  byCategory: Record<string, number>;
};

// TODO Phase 4: parsers for AIB and BoI CSV formats
// TODO Phase 4: Ollama client for transaction categorisation (http://localhost:11434)
// TODO Phase 4: month-over-month diff calculation
// TODO Phase 4: SQLite persistence via tauri-plugin-sql (DB path: app_data_dir()/eolas/finance.db)
//   Tables: transactions, categories, monthly_summaries
//   Migrations live in packages/finance/migrations/
//   Financial data is NEVER written to or read from the Railway PostgreSQL instance.
