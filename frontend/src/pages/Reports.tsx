import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { TrendLineChart } from "../components/TrendLineChart";
import { InsightsList } from "../components/InsightsList";
import { currentMonthKey, monthLabel } from "../lib/format";

export function Reports() {
  const [month, setMonth] = useState(currentMonthKey());

  const summary = useQuery({ queryKey: ["summary", month], queryFn: () => api.getSummary(month) });
  const insights = useQuery({ queryKey: ["insights", month], queryFn: () => api.getInsights(month) });

  return (
    <div className="stack">
      <div className="filters-row">
        <label>
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <p className="section-title">Income vs expense — last 6 months</p>
        {summary.isLoading && <p>Loading…</p>}
        {summary.data && <TrendLineChart data={summary.data.trend} />}
      </div>

      <div className="card">
        <p className="section-title">Suggestions for {monthLabel(month)}</p>
        {insights.isLoading && <p>Loading…</p>}
        {insights.data && <InsightsList insights={insights.data.insights} />}
      </div>
    </div>
  );
}
