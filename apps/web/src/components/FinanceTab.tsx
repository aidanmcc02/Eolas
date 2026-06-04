import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { parseAIBCsv } from '../lib/finance/parser';
import { categorizeTransactions, generateInsights, applyAmountOverrides } from '../lib/finance/ollama';
import { groupByCategory, groupByMonth, buildInsightsSummary, formatMonth, formatCurrency, totalSavings, totalSpend as calcTotalSpend } from '../lib/finance/analysis';
import { initDb, saveTransactions, loadTransactions, updateCategories, markMonthSaved, clearAllUnsaved, clearAll } from '../lib/finance/db';
import type { Transaction, CategorySummary, MonthSummary } from '../lib/finance/types';
import { CATEGORY_COLORS, CATEGORIES } from '../lib/finance/types';

type View = 'overview' | 'transactions' | 'insights';
type SelectedMonth = 'overall' | string; // 'overall' or 'YYYY-MM'

function previousMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

export function FinanceTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState('');
  const [view, setView] = useState<View>('overview');
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>('overall');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initDb()
      .then(() => loadTransactions())
      .then((txs) => {
        if (txs.length === 0) return;
        setTransactions(txs);
        // Auto-select the most recent month present in the data
        const latest = txs.map((t) => t.date.slice(0, 7)).sort().at(-1);
        if (latest) setSelectedMonth(latest);
      })
      .catch((e) => setStatus(`ERR: ${String(e)}`));
  }, []);

  // All months that have any transactions, newest first
  const availableMonths = useMemo(() => {
    const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))];
    return months.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Whether every transaction in a given month is saved
  const isMonthSaved = useCallback((month: string) => {
    const txs = transactions.filter((t) => t.date.startsWith(month));
    return txs.length > 0 && txs.every((t) => t.saved);
  }, [transactions]);

  // Transactions visible in the current view
  const viewTransactions = useMemo(() => {
    if (selectedMonth === 'overall') {
      return transactions.filter((t) => t.saved);
    }
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const categories = useMemo(() => groupByCategory(viewTransactions), [viewTransactions]);
  const months = useMemo(() => groupByMonth(viewTransactions), [viewTransactions]);

  const totalSpend = calcTotalSpend(viewTransactions);
  const totalIncome = viewTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const saved = totalSavings(viewTransactions);

  const hasData = transactions.length > 0;
  const hasViewData = viewTransactions.length > 0;

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus('PARSING CSV...');
    try {
      const text = await file.text();
      const allParsed = parseAIBCsv(text);
      if (allParsed.length === 0) {
        setStatus('ERR: No transactions found. Check CSV format.');
        setLoading(false);
        return;
      }

      // Wipe any previous unsaved working data before starting a fresh import
      await clearAllUnsaved();

      // Only keep the previous calendar month — user imports on the 1st for last month
      const targetMonth = previousMonth();
      const parsed = allParsed.filter((t) => t.date.startsWith(targetMonth));
      if (parsed.length === 0) {
        setStatus(`ERR: No transactions found for ${formatMonth(targetMonth)}. CSV contains ${[...new Set(allParsed.map(t => t.date.slice(0,7)))].join(', ')}.`);
        setLoading(false);
        return;
      }

      setStatus(`FOUND ${parsed.length} TRANSACTIONS FOR ${formatMonth(targetMonth).toUpperCase()}. RUNNING ANALYSIS...`);
      setAnalyzing(true);
      setAnalyzeProgress(0);

      const categoryMap = await categorizeTransactions(parsed, (done, total) => {
        setAnalyzeProgress(Math.round((done / total) * 100));
      });

      const categorized = applyAmountOverrides(
        parsed.map((t) => ({ ...t, category: categoryMap.get(t.description) ?? 'Other' }))
      );

      await saveTransactions(categorized);
      const all = await loadTransactions();
      setTransactions(all);
      setSelectedMonth(targetMonth);

      setStatus(`IMPORT COMPLETE — ${categorized.length} TRANSACTIONS FOR ${formatMonth(targetMonth).toUpperCase()}`);
      setAnalyzing(false);
    } catch (err) {
      setStatus(`ERR: ${String(err)}`);
    } finally {
      setLoading(false);
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleGenerateInsights() {
    if (viewTransactions.length === 0) return;
    setLoading(true);
    setStatus('GENERATING INSIGHTS...');
    try {
      const summary = buildInsightsSummary(viewTransactions, months);
      const text = await generateInsights(summary);
      setInsights(text);
      setView('insights');
      setStatus('ANALYSIS COMPLETE');
    } catch (err) {
      setStatus(`ERR: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (selectedMonth === 'overall') return;
    const count = await markMonthSaved(selectedMonth);
    const all = await loadTransactions();
    setTransactions(all);
    setStatus(`SAVED — ${count} transactions locked for ${formatMonth(selectedMonth)}`);
  }

  async function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    await clearAllUnsaved();
    const all = await loadTransactions();
    setTransactions(all);
    setInsights('');
    setSelectedMonth('overall');
    setStatus('CLEARED — unsaved data removed');
  }

  async function handleClearAll() {
    if (!confirmClearAll) { setConfirmClearAll(true); return; }
    setConfirmClearAll(false);
    await clearAll();
    setTransactions([]);
    setSelectedMonth('overall');
    setInsights('');
    setStatus('ALL DATA CLEARED');
  }

  const filteredTxs = viewTransactions.filter((t) => {
    const matchesText = filter === '' || t.description.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = catFilter === 'all' || t.category === catFilter;
    return matchesText && matchesCat;
  });

  const onRecategorize = useCallback(async (txId: string, cat: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (tx) await updateCategories(new Map([[tx.description, cat]]));
    setTransactions((prev) => prev.map((t) => t.id === txId ? { ...t, category: cat } : t));
  }, [transactions]);

  const monthSaved = selectedMonth !== 'overall' && isMonthSaved(selectedMonth);

  return (
    <div className="flex-1 flex flex-col min-h-0 font-mono text-[#00ff41]">
      {/* Top header — view tabs + actions */}
      <div className="border-b border-[#00ff4122] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs tracking-widest text-[#00ff4155]">// FINANCE</span>
          {hasViewData && (
            <div className="flex gap-1">
              {(['overview', 'transactions', 'insights'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs tracking-widest border transition-colors ${
                    view === v
                      ? 'border-[#00ff4155] bg-[#00ff410a] text-[#00ff41]'
                      : 'border-[#00ff4122] text-[#00ff4155] hover:border-[#00ff4144] hover:text-[#00ff4188]'
                  }`}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasData && selectedMonth !== 'overall' && (
            <>
              <button
                onClick={handleGenerateInsights}
                disabled={loading || !hasViewData}
                className="px-3 py-1 text-xs tracking-widest border border-[#00ff4138] hover:border-[#00ff4165] hover:bg-[#00ff410d] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'WORKING...' : 'AI INSIGHTS'}
              </button>
              {!monthSaved && (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-3 py-1 text-xs tracking-widest border border-[#00ddff44] text-[#00ddffaa] hover:border-[#00ddff88] hover:text-[#00ddff] hover:bg-[#00ddff0d] disabled:opacity-40"
                >
                  SAVE MONTH
                </button>
              )}
              <button
                onClick={handleClear}
                onBlur={() => setConfirmClear(false)}
                className={`px-3 py-1 text-xs tracking-widest border transition-colors ${
                  confirmClear
                    ? 'border-[#ff0040] text-[#ff0040] bg-[#ff00400d]'
                    : 'border-[#ff004022] text-[#ff004088] hover:border-[#ff004066] hover:text-[#ff0040]'
                }`}
              >
                {confirmClear ? 'CONFIRM?' : 'CLEAR'}
              </button>
            </>
          )}
          {hasData && selectedMonth === 'overall' && (
            <button
              onClick={handleClearAll}
              onBlur={() => setConfirmClearAll(false)}
              className={`px-3 py-1 text-xs tracking-widest border transition-colors ${
                confirmClearAll
                  ? 'border-[#ff0040] text-[#ff0040] bg-[#ff00400d]'
                  : 'border-[#ff004022] text-[#ff004055] hover:border-[#ff004055] hover:text-[#ff004099]'
              }`}
            >
              {confirmClearAll ? 'CONFIRM?' : 'CLEAR ALL'}
            </button>
          )}
          <label className="px-3 py-1 text-xs tracking-widest border border-[#00ff4138] hover:border-[#00ff4165] hover:bg-[#00ff410d] cursor-pointer">
            IMPORT CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Month selector row */}
      <div className="border-b border-[#00ff4111] px-4 py-1.5 flex items-center gap-1 flex-shrink-0 overflow-x-auto">
        {/* Overall tab */}
        <MonthTab
          label="OVERALL"
          active={selectedMonth === 'overall'}
          saved={transactions.some((t) => t.saved)}
          onClick={() => setSelectedMonth('overall')}
        />
        {availableMonths.map((m) => (
          <MonthTab
            key={m}
            label={formatMonth(m).toUpperCase()}
            active={selectedMonth === m}
            saved={isMonthSaved(m)}
            onClick={() => setSelectedMonth(m)}
          />
        ))}
        {!hasData && (
          <span className="text-[#00ff4133] text-xs">no data — import a CSV to begin</span>
        )}
      </div>

      {/* Status bar */}
      {status && (
        <div className="px-4 py-1 text-xs border-b border-[#00ff4111] bg-[#00ff4108] flex-shrink-0">
          {analyzing ? (
            <div className="flex items-center gap-3">
              <span className="text-[#00ff4188]">{status}</span>
              <div className="flex-1 max-w-xs bg-[#00ff4111] h-1.5">
                <div className="h-full bg-[#00ff41] transition-all" style={{ width: `${analyzeProgress}%` }} />
              </div>
              <span className="text-[#00ff4188]">{analyzeProgress}%</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[#00ff4188]">{status}</span>
              {monthSaved && selectedMonth !== 'overall' && (
                <span className="text-[#00ddff88] text-xs">✓ SAVED</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!hasViewData ? (
          <EmptyState
            selectedMonth={selectedMonth}
            hasSavedData={transactions.some((t) => t.saved)}
            onImport={() => fileRef.current?.click()}
          />
        ) : view === 'overview' ? (
          <OverviewView
            categories={categories}
            months={months}
            totalSpend={totalSpend}
            totalIncome={totalIncome}
            totalSaved={saved}
            txCount={viewTransactions.length}
            isOverall={selectedMonth === 'overall'}
            otherTransactions={viewTransactions.filter((t) => t.category === 'Other' && t.amount < 0)}
            onRecategorize={onRecategorize}
          />
        ) : view === 'transactions' ? (
          <TransactionsView
            transactions={filteredTxs}
            filter={filter}
            catFilter={catFilter}
            onFilterChange={setFilter}
            onCatFilterChange={setCatFilter}
            allCategories={[...new Set(viewTransactions.map((t) => t.category))].sort()}
            onRecategorize={onRecategorize}
          />
        ) : (
          <InsightsView insights={insights} categories={categories} months={months} />
        )}
      </div>
    </div>
  );
}

function MonthTab({
  label, active, saved, onClick, disabled = false,
}: {
  label: string;
  active: boolean;
  saved: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1 text-xs tracking-widest border flex-shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'border-[#00ff4155] bg-[#00ff410a] text-[#00ff41]'
          : 'border-[#00ff4118] text-[#00ff4144] hover:border-[#00ff4133] hover:text-[#00ff4177]'
      }`}
    >
      {label}
      {saved ? (
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] opacity-70 flex-shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffaa00] opacity-70 flex-shrink-0" />
      )}
    </button>
  );
}

function EmptyState({
  selectedMonth, hasSavedData, onImport,
}: {
  selectedMonth: SelectedMonth;
  hasSavedData: boolean;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-[#00ff4133] text-6xl font-mono">€_</div>
      <div className="text-center">
        {selectedMonth === 'overall' && !hasSavedData ? (
          <>
            <p className="text-[#00ff4188] text-sm tracking-widest mb-1">NO SAVED DATA</p>
            <p className="text-[#00ff4144] text-xs">Import a month, review it, then hit SAVE MONTH.</p>
          </>
        ) : selectedMonth === 'overall' ? (
          <>
            <p className="text-[#00ff4188] text-sm tracking-widest mb-1">NO SAVED DATA YET</p>
            <p className="text-[#00ff4144] text-xs">Select a month and hit SAVE MONTH to add it to the overall view.</p>
          </>
        ) : (
          <>
            <p className="text-[#00ff4188] text-sm tracking-widest mb-1">NO DATA FOR {selectedMonth}</p>
            <p className="text-[#00ff4144] text-xs">Import a CSV containing transactions for this month.</p>
          </>
        )}
      </div>
      {selectedMonth !== 'overall' && (
        <button
          onClick={onImport}
          className="px-6 py-2 text-sm tracking-widest border border-[#00ff4155] hover:bg-[#00ff410d] hover:border-[#00ff41] hover:shadow-[0_0_10px_rgba(0,255,65,0.15)]"
        >
          IMPORT CSV
        </button>
      )}
    </div>
  );
}

function OverviewView({
  categories, months, totalSpend, totalIncome, totalSaved, txCount,
  isOverall, otherTransactions, onRecategorize,
}: {
  categories: CategorySummary[];
  months: MonthSummary[];
  totalSpend: number;
  totalIncome: number;
  totalSaved: number;
  txCount: number;
  isOverall: boolean;
  otherTransactions: Transaction[];
  onRecategorize: (txId: string, cat: string) => Promise<void>;
}) {
  const recentMonths = months.slice(-6);
  const netFlow = totalIncome - totalSpend;
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="TOTAL SPEND" value={formatCurrency(totalSpend)} color="#ff0040" />
        <StatCard label="TOTAL INCOME" value={formatCurrency(totalIncome)} color="#00ff41" />
        <StatCard label="SAVED" value={formatCurrency(totalSaved)} color="#00ddff" />
        <StatCard
          label="NET FLOW"
          value={`${netFlow >= 0 ? '+' : '-'}${formatCurrency(netFlow)}`}
          color={netFlow >= 0 ? '#00ff41' : '#ff0040'}
        />
        <StatCard label="TRANSACTIONS" value={String(txCount)} color="#00ff41" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[#00ff4122] bg-[#0a0a0a] p-4">
          <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// SPEND BY CATEGORY</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categories}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
                onMouseEnter={(_, index) => setHoveredCategory(categories[index]?.category ?? null)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                {categories.map((c) => (
                  <Cell
                    key={c.category}
                    fill={c.color}
                    stroke={hoveredCategory === c.category ? c.color : 'transparent'}
                    strokeWidth={2}
                    opacity={hoveredCategory === null || hoveredCategory === c.category ? 1 : 0.4}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0d0d0d', border: '1px solid #00ff4133', borderRadius: 0, fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#00ff41' }}
                formatter={(val) => [`€${Number(val).toFixed(2)}`, '']}
              />
              <Legend formatter={(value) => <span style={{ color: '#00ff4188', fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }}>{value}</span>} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[#00ff4122] bg-[#0a0a0a] p-4">
          <p className="text-[#00ff4155] text-xs tracking-widest mb-3">
            {isOverall ? '// MONTHLY SPEND (ALL TIME)' : '// MONTHLY SPEND'}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={recentMonths} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#00ff4166', fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }} axisLine={{ stroke: '#00ff4122' }} tickLine={false} />
              <YAxis tick={{ fill: '#00ff4166', fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }} axisLine={{ stroke: '#00ff4122' }} tickLine={false} tickFormatter={(v) => `€${v}`} />
              <Tooltip
                contentStyle={{ background: '#0d0d0d', border: '1px solid #00ff4133', borderRadius: 0, fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#00ff41' }}
                formatter={(val) => [`€${Number(val).toFixed(2)}`, '']}
                labelFormatter={(label) => formatMonth(String(label))}
              />
              <Bar dataKey="totalSpend" fill="#00cc33" name="Spend" radius={0} />
              <Bar dataKey="totalIncome" fill="#00ff4133" name="Income" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-[#00ff4122] bg-[#0a0a0a]">
        <p className="text-[#00ff4155] text-xs tracking-widest px-4 py-3 border-b border-[#00ff4111]">// CATEGORY BREAKDOWN</p>
        <div className="divide-y divide-[#00ff410a]">
          {categories.map((c) => {
            const isHovered = hoveredCategory === c.category;
            const isDimmed = hoveredCategory !== null && !isHovered;
            return (
              <div
                key={c.category}
                className="px-4 flex items-center gap-3 transition-all duration-150"
                style={{
                  paddingTop: isHovered ? '10px' : '6px',
                  paddingBottom: isHovered ? '10px' : '6px',
                  opacity: isDimmed ? 0.35 : 1,
                  background: isHovered ? `${c.color}0d` : 'transparent',
                }}
              >
                <div
                  className="rounded-full flex-shrink-0 transition-all duration-150"
                  style={{ background: c.color, width: isHovered ? 10 : 8, height: isHovered ? 10 : 8 }}
                />
                <span
                  className="flex-1 transition-all duration-150"
                  style={{ color: isHovered ? c.color : '#00ff4188', fontSize: isHovered ? 13 : 12 }}
                >
                  {c.category}
                </span>
                <span
                  className="transition-all duration-150"
                  style={{ color: '#00ff4155', fontSize: isHovered ? 12 : 11 }}
                >
                  {c.count} txn
                </span>
                <span
                  className="text-right w-24 transition-all duration-150"
                  style={{ color: c.color, fontSize: isHovered ? 14 : 12, fontWeight: isHovered ? 600 : 400 }}
                >
                  {formatCurrency(c.total)}
                </span>
                <div className="w-32 bg-[#00ff4111] h-1 flex-shrink-0">
                  <div
                    className="h-full transition-all duration-150"
                    style={{ width: `${(c.total / (categories[0]?.total ?? 1)) * 100}%`, background: c.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isOverall && otherTransactions.length > 0 && (
        <div className="border border-[#ffaa0033] bg-[#0a0a0a]">
          <p className="text-[#ffaa00] text-xs tracking-widest px-4 py-3 border-b border-[#ffaa0022]">
            // UNCATEGORIZED — {otherTransactions.length} transactions need review
          </p>
          <div className="divide-y divide-[#ffaa000a] max-h-64 overflow-y-auto">
            {otherTransactions.map((t) => (
              <div key={t.id} className="px-4 py-2 flex items-center gap-3">
                <span className="text-xs text-[#00ff4155] w-24 flex-shrink-0">{t.date}</span>
                <span className="text-xs text-[#ffaa0099] flex-1 truncate">{t.description}</span>
                <span className="text-xs text-[#ff004099] w-20 text-right flex-shrink-0">
                  {t.amount < 0 ? '-' : '+'}{formatCurrency(t.amount)}
                </span>
                <select
                  defaultValue="Other"
                  onChange={async (e) => { await onRecategorize(t.id, e.target.value); }}
                  className="bg-[#0d0d0d] border border-[#ffaa0033] text-[#ffaa00] text-xs px-2 py-1 font-mono outline-none flex-shrink-0"
                >
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-[#00ff4122] bg-[#0a0a0a] px-4 py-3">
      <p className="text-[#00ff4144] text-xs tracking-widest mb-1">{label}</p>
      <p className="text-lg font-mono animate-glow-pulse" style={{ color }}>{value}</p>
    </div>
  );
}

function TransactionsView({
  transactions, filter, catFilter, onFilterChange, onCatFilterChange, allCategories, onRecategorize,
}: {
  transactions: Transaction[];
  filter: string;
  catFilter: string;
  onFilterChange: (v: string) => void;
  onCatFilterChange: (v: string) => void;
  allCategories: string[];
  onRecategorize: (id: string, cat: string) => Promise<void>;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 border border-[#00ff4122] focus-within:border-[#00ff4155] bg-[#0a0a0a]">
          <input
            type="text"
            placeholder="filter transactions..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full bg-transparent px-3 py-2 text-xs text-[#00ff41] placeholder-[#00ff4133] outline-none font-mono"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => onCatFilterChange(e.target.value)}
          className="bg-[#0a0a0a] border border-[#00ff4122] text-[#00ff4188] text-xs px-3 py-2 font-mono outline-none"
        >
          <option value="all">ALL CATEGORIES</option>
          {allCategories.map((c) => (<option key={c} value={c}>{c.toUpperCase()}</option>))}
        </select>
      </div>
      <div className="border border-[#00ff4122] bg-[#0a0a0a]">
        <div className="grid grid-cols-[120px_1fr_120px_140px] text-xs text-[#00ff4144] tracking-widest px-4 py-2 border-b border-[#00ff4111]">
          <span>DATE</span><span>DESCRIPTION</span><span className="text-right">AMOUNT</span><span className="text-right">CATEGORY</span>
        </div>
        <div className="divide-y divide-[#00ff410a] max-h-[calc(100vh-320px)] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="px-4 py-8 text-xs text-center text-[#00ff4133]">NO MATCHING TRANSACTIONS</p>
          ) : (
            transactions.map((t) => <TransactionRow key={t.id} transaction={t} onRecategorize={onRecategorize} />)
          )}
        </div>
      </div>
      <p className="text-xs text-[#00ff4133] text-right">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

function TransactionRow({ transaction: t, onRecategorize }: { transaction: Transaction; onRecategorize: (id: string, cat: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const color = CATEGORY_COLORS[t.category] ?? '#444444';
  const isDebit = t.amount < 0;
  return (
    <div className="grid grid-cols-[120px_1fr_120px_140px] text-xs px-4 py-2 hover:bg-[#00ff4105] items-center">
      <span className="text-[#00ff4155]">{t.date}</span>
      <span className="text-[#00ff4188] truncate pr-4">{t.description}</span>
      <span className={`text-right font-mono ${isDebit ? 'text-[#ff0040aa]' : 'text-[#00ff4188]'}`}>
        {isDebit ? '-' : '+'}{formatCurrency(t.amount)}
      </span>
      <div className="text-right">
        {editing ? (
          <select
            autoFocus
            defaultValue={t.category}
            onBlur={() => setEditing(false)}
            onChange={async (e) => { await onRecategorize(t.id, e.target.value); setEditing(false); }}
            className="bg-[#0d0d0d] border border-[#00ff4133] text-[#00ff41] text-xs py-0.5 px-1 font-mono outline-none w-full"
          >
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs hover:underline" style={{ color }}>{t.category}</button>
        )}
      </div>
    </div>
  );
}

function InsightsView({ insights, categories, months }: { insights: string; categories: CategorySummary[]; months: MonthSummary[] }) {
  const last3 = months.slice(-3);
  return (
    <div className="p-4 space-y-4">
      <div className="border border-[#00ff4122] bg-[#0a0a0a] p-4">
        <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// AI ANALYSIS — qwen2.5:7b</p>
        {insights ? (
          <div className="space-y-1">
            {insights.split('\n').map((line, i) => (
              <p key={i} className={`text-xs ${line.startsWith('•') ? 'text-[#00cc33]' : 'text-[#00ff4188]'}`}>{line || ' '}</p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#00ff4133]">Click AI INSIGHTS to generate analysis with Ollama.</p>
        )}
      </div>
      {last3.length >= 2 && (
        <div className="border border-[#00ff4122] bg-[#0a0a0a] p-4">
          <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// MONTH-OVER-MONTH</p>
          <div className="space-y-2">
            {last3.slice(1).map((month, i) => {
              const prev = last3[i]!;
              const delta = month.totalSpend - prev.totalSpend;
              const pct = prev.totalSpend > 0 ? (delta / prev.totalSpend) * 100 : 0;
              return (
                <div key={month.month} className="flex items-center gap-3 text-xs">
                  <span className="text-[#00ff4155] w-16">{formatMonth(month.month)}</span>
                  <span className="text-[#00ff4188]">€{month.totalSpend.toFixed(2)}</span>
                  <span className={delta > 0 ? 'text-[#ff0040]' : 'text-[#00ff41]'}>{delta > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>
                  <span className="text-[#00ff4133]">vs {formatMonth(prev.month)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="border border-[#00ff4122] bg-[#0a0a0a] p-4">
        <p className="text-[#00ff4155] text-xs tracking-widest mb-3">// TOP CATEGORIES</p>
        <div className="space-y-2">
          {categories.slice(0, 6).map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-[#00ff4188] flex-1">{c.category}</span>
              <span className="text-xs" style={{ color: c.color }}>€{c.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

