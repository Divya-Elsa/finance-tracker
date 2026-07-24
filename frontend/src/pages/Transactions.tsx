import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { TransactionForm } from "../components/TransactionForm";
import type { Transaction, TransactionType } from "../api/types";
import { currentMonthKey, formatMoney } from "../lib/format";

export function Transactions() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<TransactionType | "">("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const transactions = useQuery({
    queryKey: ["transactions", month, categoryId, type],
    queryFn: () =>
      api.getTransactions({
        month,
        categoryId: categoryId || undefined,
        type: (type as TransactionType) || undefined,
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  }

  const createMutation = useMutation({
    mutationFn: api.createTransaction,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: Parameters<typeof api.updateTransaction>[1] }) =>
      api.updateTransaction(vars.id, vars.data),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: invalidate,
  });

  const categoryList = categories.data?.categories ?? [];

  return (
    <div className="stack">
      <div className="card">
        <p className="section-title">{editing ? "Edit transaction" : "Add a transaction"}</p>
        <TransactionForm
          categories={categoryList}
          initial={editing ?? undefined}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={async (data) => {
            if (editing) {
              await updateMutation.mutateAsync({ id: editing.id, data });
            } else {
              await createMutation.mutateAsync(data);
            }
          }}
        />
      </div>

      <div className="card">
        <p className="section-title">Transactions</p>
        <div className="filters-row">
          <label>
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as TransactionType | "")}>
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
        </div>

        {transactions.isLoading && <p>Loading…</p>}
        {transactions.data && transactions.data.transactions.length === 0 && (
          <p className="empty-state">No transactions match these filters.</p>
        )}
        {transactions.data && transactions.data.transactions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.data.transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.date.slice(0, 10)}</td>
                  <td>{t.category.name}</td>
                  <td>{t.description ?? "—"}</td>
                  <td style={{ color: t.type === "income" ? "var(--success-text)" : "var(--critical)" }}>
                    {t.type === "income" ? "+" : "-"}
                    {formatMoney(t.amount)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          if (confirm("Delete this transaction?")) deleteMutation.mutate(t.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
