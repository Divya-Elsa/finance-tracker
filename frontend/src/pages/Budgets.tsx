import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { BudgetMeter } from "../components/BudgetMeter";
import { currentMonthKey } from "../lib/format";

export function Budgets() {
  const queryClient = useQueryClient();
  const month = currentMonthKey();

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: api.getBudgets });
  const summary = useQuery({ queryKey: ["summary", month], queryFn: () => api.getSummary(month) });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const upsertMutation = useMutation({
    mutationFn: (vars: { categoryId: string; monthlyLimit: number }) =>
      api.upsertBudget(vars.categoryId, vars.monthlyLimit),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteBudget,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  if (categories.isLoading || budgets.isLoading || summary.isLoading) return <p>Loading…</p>;

  const expenseCategories = (categories.data?.categories ?? []).filter((c) => c.type === "expense");
  const budgetByCategory = new Map((budgets.data?.budgets ?? []).map((b) => [b.categoryId, b]));
  const spentByCategory = new Map((summary.data?.byCategory ?? []).map((c) => [c.categoryId, c.amount]));

  function handleSave(e: FormEvent, categoryId: string) {
    e.preventDefault();
    const raw = drafts[categoryId];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    upsertMutation.mutate({ categoryId, monthlyLimit: value });
  }

  return (
    <div className="stack">
      <div className="card">
        <p className="section-title">Monthly budgets</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: -6 }}>
          Set a monthly spending limit per category. Progress reflects {month}.
        </p>
        <div className="stack" style={{ gap: 20, marginTop: 16 }}>
          {expenseCategories.map((c) => {
            const budget = budgetByCategory.get(c.id);
            const spent = spentByCategory.get(c.id) ?? 0;
            return (
              <div key={c.id}>
                {budget ? (
                  <>
                    <BudgetMeter categoryName={c.name} spent={spent} limit={budget.monthlyLimit} />
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setDrafts((d) => ({ ...d, [c.id]: String(budget.monthlyLimit) }))}
                      >
                        Edit limit
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => deleteMutation.mutate(budget.id)}
                      >
                        Remove budget
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="meter-labels" style={{ marginBottom: 6 }}>
                    <span>{c.name}</span>
                    <span style={{ color: "var(--text-muted)" }}>No budget set</span>
                  </div>
                )}
                {(drafts[c.id] !== undefined || !budget) && (
                  <form className="filters-row" onSubmit={(e) => handleSave(e, c.id)} style={{ marginTop: 6 }}>
                    <label>
                      Monthly limit
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 300"
                        value={drafts[c.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      />
                    </label>
                    <button type="submit">Save</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
