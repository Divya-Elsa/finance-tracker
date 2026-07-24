import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { CategoryBarChart } from "../components/CategoryBarChart";
import { currentMonthKey, formatMoney } from "../lib/format";

export function Dashboard() {
  const month = currentMonthKey();
  const summary = useQuery({ queryKey: ["summary", month], queryFn: () => api.getSummary(month) });

  if (summary.isLoading) return <p>Loading…</p>;
  if (summary.error) return <p className="error-text">Failed to load dashboard.</p>;

  const totals = summary.data!.totals;
  const savingsRateLabel =
    totals.savingsRate === null ? "—" : `${(totals.savingsRate * 100).toFixed(0)}%`;

  return (
    <div className="stack">
      <div className="kpi-row">
        <StatCard label="Income this month" value={formatMoney(totals.income)} tone="positive" />
        <StatCard label="Expenses this month" value={formatMoney(totals.expense)} tone="negative" />
        <StatCard
          label="Net"
          value={formatMoney(totals.net)}
          tone={totals.net >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Savings rate" value={savingsRateLabel} />
      </div>

      <div className="card">
        <p className="section-title">Spending by category</p>
        <CategoryBarChart data={summary.data!.byCategory} />
      </div>
    </div>
  );
}
