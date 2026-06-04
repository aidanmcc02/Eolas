// Finance analysis — LOCAL ONLY. Phase 4 complete.
// This package must never be imported by apps/api or apps/agents.
// All LLM inference goes to Ollama at http://localhost:11434.
// No financial data leaves the local machine.
//
// Implementation lives in apps/web/src/lib/finance/ (runs in the Tauri webview).
// This package retains shared type definitions only.

export type Transaction = {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  description: string;
  amount: number; // negative = debit, positive = credit
  currency: 'EUR';
  category: string;
  importDate: string;
};

export type MonthSummary = {
  month: string; // YYYY-MM
  totalSpend: number;
  totalIncome: number;
  byCategory: Record<string, number>;
};
