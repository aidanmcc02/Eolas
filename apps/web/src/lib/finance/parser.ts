import type { Transaction } from './types';

// AIB CSV format (two variants):
// Variant A: Posted Account,Date,Description,Debit,Credit,Balance
// Variant B: Date,Description,Debit,Credit,Balance
// Date format: DD/MM/YYYY
// Amounts: may contain commas e.g. "1,234.50" — strip before parsing

function stripCommas(s: string): string {
  return s.replace(/,/g, '');
}

function parseAmount(debit: string, credit: string): number {
  const d = parseFloat(stripCommas(debit.trim()));
  const c = parseFloat(stripCommas(credit.trim()));
  if (!isNaN(c) && c > 0) return c;
  if (!isNaN(d) && d > 0) return -d;
  return 0;
}

function parseDate(raw: string): string {
  // DD/MM/YYYY or DD/MM/YY → YYYY-MM-DD
  const parts = raw.trim().split('/');
  if (parts.length === 3) {
    const [dd, mm, yy] = parts;
    const yyyy = yy && yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }
  return raw.trim();
}

function uid(date: string, desc: string, amount: number, index: number): string {
  return `${date}_${desc.slice(0, 20).replace(/\s+/g, '_')}_${amount}_${index}`;
}

export function parseAIBCsv(csvText: string): Transaction[] {
  const lines = csvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0]!.toLowerCase();
  const hasAccountCol = header.startsWith('posted account');
  const dataLines = lines.slice(1);

  const transactions: Transaction[] = [];
  const importDate = new Date().toISOString();

  dataLines.forEach((line, i) => {
    // Handle quoted fields
    const cols = splitCsvLine(line);
    if (cols.length < 4) return;

    let date: string;
    let description: string;
    let debit: string;
    let credit: string;

    if (hasAccountCol && cols.length >= 5) {
      // Posted Account, Date, Description, Debit, Credit, Balance
      date = parseDate(cols[1] ?? '');
      description = (cols[2] ?? '').trim();
      debit = cols[3] ?? '';
      credit = cols[4] ?? '';
    } else {
      // Date, Description, Debit, Credit, Balance
      date = parseDate(cols[0] ?? '');
      description = (cols[1] ?? '').trim();
      debit = cols[2] ?? '';
      credit = cols[3] ?? '';
    }

    if (!date || !description) return;

    const amount = parseAmount(debit, credit);
    transactions.push({
      id: uid(date, description, amount, i),
      date,
      description,
      amount,
      currency: 'EUR',
      category: 'Other',
      importDate,
      saved: false,
    });
  });

  return transactions;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
