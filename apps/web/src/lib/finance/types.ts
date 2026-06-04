export type Transaction = {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  description: string;
  amount: number; // negative = debit, positive = credit
  currency: 'EUR';
  category: string;
  importDate: string; // ISO 8601
  saved: boolean;
};

export type CategorySummary = {
  category: string;
  total: number;
  count: number;
  color: string;
};

export type MonthSummary = {
  month: string; // YYYY-MM
  totalSpend: number;
  totalIncome: number;
  byCategory: Record<string, number>;
};

export const CATEGORY_COLORS: Record<string, string> = {
  Groceries: '#00ff41',
  'Dining & Cafes': '#00cc33',
  Transport: '#ffaa00',
  Shopping: '#ff6600',
  Entertainment: '#4488ff',
  Subscriptions: '#ff44cc',
  'Health & Fitness': '#00ffcc',
  'Utilities & Bills': '#ff0040',
  Housing: '#cc44ff',
  Travel: '#ffff44',
  Savings: '#00ddff',
  Loan: '#ff8800',
  Income: '#44ff88',
  Transfers: '#666666',
  Other: '#444444',
};

// Excluded from the "total spend" stat — not real expenditure.
export const NON_SPEND_CATEGORIES = new Set(['Savings', 'Transfers', 'Income']);

// Excluded from the pie chart — purely financial movements with no spending insight.
export const NON_CHART_CATEGORIES = new Set(['Savings', 'Income']);

export const CATEGORIES = Object.keys(CATEGORY_COLORS);
