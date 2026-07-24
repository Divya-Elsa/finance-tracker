import { FormEvent, useState } from "react";
import type { Category, Transaction, TransactionType } from "../api/types";

interface Props {
  categories: Category[];
  initial?: Transaction;
  onSubmit: (data: {
    categoryId: string;
    amount: number;
    type: TransactionType;
    date: string;
    description?: string;
  }) => Promise<void>;
  onCancel?: () => void;
}

function toDateInputValue(iso?: string) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

export function TransactionForm({ categories, initial, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories.find((c) => c.type === type)?.id ?? ""
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(toDateInputValue(initial?.date));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableCategories = categories.filter((c) => c.type === type);

  function handleTypeChange(next: TransactionType) {
    setType(next);
    const firstOfType = categories.find((c) => c.type === next);
    if (firstOfType) setCategoryId(firstOfType.id);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!categoryId) {
      setError("Choose a category");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ categoryId, amount: parsedAmount, type, date, description: description || undefined });
      if (!initial) {
        setAmount("");
        setDescription("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stacked" onSubmit={handleSubmit}>
      <label>
        Type
        <select value={type} onChange={(e) => handleTypeChange(e.target.value as TransactionType)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label>
        Category
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Description (optional)
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <span className="error-text">{error}</span>}
      <div className="row-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Add transaction"}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
