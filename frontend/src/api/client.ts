import type { Budget, Category, InsightsResponse, SummaryResponse, Transaction, TransactionType } from "./types";

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {}

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

export const api = {
  signup: (email: string, password: string) =>
    request<AuthResult>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResult>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: { id: string; email: string } }>("/api/auth/me"),

  getCategories: () => request<{ categories: Category[] }>("/api/categories"),
  createCategory: (name: string, type: TransactionType) =>
    request<{ category: Category }>("/api/categories", { method: "POST", body: JSON.stringify({ name, type }) }),
  deleteCategory: (id: string) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),

  getTransactions: (params: { month?: string; categoryId?: string; type?: TransactionType }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<{ transactions: Transaction[] }>(`/api/transactions?${qs.toString()}`);
  },
  createTransaction: (data: {
    categoryId: string;
    amount: number;
    type: TransactionType;
    date: string;
    description?: string;
  }) => request<{ transaction: Transaction }>("/api/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (
    id: string,
    data: Partial<{ categoryId: string; amount: number; type: TransactionType; date: string; description: string }>
  ) => request<{ transaction: Transaction }>(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => request<void>(`/api/transactions/${id}`, { method: "DELETE" }),

  getBudgets: () => request<{ budgets: Budget[] }>("/api/budgets"),
  upsertBudget: (categoryId: string, monthlyLimit: number) =>
    request<{ budget: Budget }>("/api/budgets", { method: "PUT", body: JSON.stringify({ categoryId, monthlyLimit }) }),
  deleteBudget: (id: string) => request<void>(`/api/budgets/${id}`, { method: "DELETE" }),

  getSummary: (month: string) => request<SummaryResponse>(`/api/reports/summary?month=${month}`),
  getInsights: (month: string) => request<InsightsResponse>(`/api/reports/insights?month=${month}`),
};
