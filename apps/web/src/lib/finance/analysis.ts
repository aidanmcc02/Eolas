import type { Transaction, CategorySummary, MonthSummary } from './types';
import { CATEGORY_COLORS, NON_SPEND_CATEGORIES, NON_CHART_CATEGORIES } from './types';

export function totalSpend(transactions: Transaction[]): number {
  return Math.round(
    transactions
      .filter((t) => t.amount < 0 && !NON_SPEND_CATEGORIES.has(t.category))
      .reduce((s, t) => s + Math.abs(t.amount), 0) * 100
  ) / 100;
}

export function groupByCategory(transactions: Transaction[]): CategorySummary[] {
  // Show all debits except Savings and Income — Transfers appears on the chart
  const chartDebits = transactions.filter(
    (t) => t.amount < 0 && !NON_CHART_CATEGORIES.has(t.category)
  );
  const map = new Map<string, { total: number; count: number }>();

  for (const t of chartDebits) {
    const entry = map.get(t.category) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    map.set(t.category, entry);
  }

  return Array.from(map.entries())
    .map(([category, { total, count }]) => ({
      category,
      total: Math.round(total * 100) / 100,
      count,
      color: CATEGORY_COLORS[category] ?? '#444444',
    }))
    .sort((a, b) => b.total - a.total);
}

export function totalSavings(transactions: Transaction[]): number {
  return Math.round(
    transactions
      .filter((t) => t.amount < 0 && t.category === 'Savings')
      .reduce((s, t) => s + Math.abs(t.amount), 0) * 100
  ) / 100;
}

export function groupByMonth(transactions: Transaction[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();

  for (const t of transactions) {
    const month = t.date.slice(0, 7); // YYYY-MM
    const entry = map.get(month) ?? {
      month,
      totalSpend: 0,
      totalIncome: 0,
      byCategory: {},
    };

    if (t.amount < 0) {
      // Exclude non-spend categories from totalSpend and byCategory breakdown
      if (!NON_SPEND_CATEGORIES.has(t.category)) {
        entry.totalSpend += Math.abs(t.amount);
        entry.byCategory[t.category] = (entry.byCategory[t.category] ?? 0) + Math.abs(t.amount);
      }
    } else {
      entry.totalIncome += t.amount;
    }

    map.set(month, entry);
  }

  return Array.from(map.values())
    .map((s) => ({
      ...s,
      totalSpend: Math.round(s.totalSpend * 100) / 100,
      totalIncome: Math.round(s.totalIncome * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function groupByDay(transactions: Transaction[]): Array<{ date: string; spend: number }> {
  const map = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount >= 0 || NON_SPEND_CATEGORIES.has(t.category)) continue;
    map.set(t.date, (map.get(t.date) ?? 0) + Math.abs(t.amount));
  }

  return Array.from(map.entries())
    .map(([date, spend]) => ({ date, spend: Math.round(spend * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildInsightsSummary(
  transactions: Transaction[],
  months: MonthSummary[]
): string {
  const recentMonths = months.slice(-3);
  const avgMonthlySpend =
    recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.totalSpend, 0) / recentMonths.length
      : 0;

  const categoryTotals = groupByCategory(transactions);
  const topCategories = categoryTotals.slice(0, 5);

  const lines = [
    `Period analysed: ${months[0]?.month ?? 'N/A'} to ${months[months.length - 1]?.month ?? 'N/A'}`,
    `Average monthly spend: €${avgMonthlySpend.toFixed(2)}`,
    `Top spending categories:`,
    ...topCategories.map((c) => `  - ${c.category}: €${c.total.toFixed(2)} (${c.count} transactions)`),
    ``,
    `Monthly breakdown (last 3 months):`,
    ...recentMonths.map((m) => `  ${m.month}: spent €${m.totalSpend.toFixed(2)}, income €${m.totalIncome.toFixed(2)}`),
  ];

  return lines.join('\n');
}

export function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  if (!year || !month) return yyyyMM;
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' });
}

export function formatCurrency(amount: number): string {
  return `€${Math.abs(amount).toFixed(2)}`;
}
