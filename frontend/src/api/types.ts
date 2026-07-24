export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  categoryId: string;
  category: Category;
  amount: number;
  type: TransactionType;
  date: string;
  description: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  category: Category;
  monthlyLimit: number;
}

export interface SummaryResponse {
  month: string;
  totals: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number | null;
  };
  byCategory: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percent: number;
  }[];
  trend: { month: string; income: number; expense: number }[];
}

export type InsightSeverity = "info" | "warning" | "critical";

export interface InsightsResponse {
  month: string;
  insights: { message: string; severity: InsightSeverity }[];
}
