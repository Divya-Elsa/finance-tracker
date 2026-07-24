export interface InsightTransaction {
  categoryId: string;
  categoryName: string;
  amount: number;
  type: "income" | "expense";
}

export interface InsightBudget {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
}

export type Severity = "info" | "warning" | "critical";

export interface Insight {
  message: string;
  severity: Severity;
}

const SAVINGS_RATE_WARNING_THRESHOLD = 0.2;
const MONTH_OVER_MONTH_INCREASE_THRESHOLD = 0.25;

function sumByType(transactions: InsightTransaction[], type: "income" | "expense") {
  return transactions.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
}

function sumByCategory(transactions: InsightTransaction[]) {
  const totals = new Map<string, { categoryName: string; amount: number }>();
  for (const t of transactions.filter((t) => t.type === "expense")) {
    const entry = totals.get(t.categoryId) ?? { categoryName: t.categoryName, amount: 0 };
    entry.amount += t.amount;
    totals.set(t.categoryId, entry);
  }
  return totals;
}

export function computeInsights(
  currentMonth: InsightTransaction[],
  previousMonth: InsightTransaction[],
  budgets: InsightBudget[]
): Insight[] {
  const insights: Insight[] = [];

  const income = sumByType(currentMonth, "income");
  const expense = sumByType(currentMonth, "expense");

  if (income > 0) {
    const savingsRate = (income - expense) / income;
    if (savingsRate < 0) {
      insights.push({
        message: `You spent $${(expense - income).toFixed(2)} more than you earned this month.`,
        severity: "critical",
      });
    } else if (savingsRate < SAVINGS_RATE_WARNING_THRESHOLD) {
      insights.push({
        message: `Your savings rate is ${(savingsRate * 100).toFixed(0)}%, below the recommended 20%. Consider trimming discretionary spending.`,
        severity: "warning",
      });
    } else {
      insights.push({
        message: `Nice work — you saved ${(savingsRate * 100).toFixed(0)}% of your income this month.`,
        severity: "info",
      });
    }
  }

  const currentByCategory = sumByCategory(currentMonth);
  for (const budget of budgets) {
    const spent = currentByCategory.get(budget.categoryId)?.amount ?? 0;
    if (spent > budget.monthlyLimit) {
      const overBy = spent - budget.monthlyLimit;
      const overPct = (overBy / budget.monthlyLimit) * 100;
      insights.push({
        message: `You're over budget in ${budget.categoryName} by $${overBy.toFixed(2)} (${overPct.toFixed(0)}% over your $${budget.monthlyLimit.toFixed(2)} limit).`,
        severity: "critical",
      });
    }
  }

  const previousByCategory = sumByCategory(previousMonth);
  for (const [categoryId, current] of currentByCategory) {
    const previous = previousByCategory.get(categoryId);
    if (previous && previous.amount > 0) {
      const change = (current.amount - previous.amount) / previous.amount;
      if (change > MONTH_OVER_MONTH_INCREASE_THRESHOLD) {
        insights.push({
          message: `Spending on ${current.categoryName} is up ${(change * 100).toFixed(0)}% from last month ($${previous.amount.toFixed(2)} → $${current.amount.toFixed(2)}).`,
          severity: "warning",
        });
      }
    }
  }

  const topCategories = [...currentByCategory.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  if (topCategories.length > 0 && expense > 0) {
    const summary = topCategories
      .map((c) => `${c.categoryName} ($${c.amount.toFixed(2)}, ${((c.amount / expense) * 100).toFixed(0)}%)`)
      .join(", ");
    insights.push({
      message: `Your top spending categories this month: ${summary}.`,
      severity: "info",
    });
  }

  const largest = [...currentMonth.filter((t) => t.type === "expense")].sort(
    (a, b) => b.amount - a.amount
  )[0];
  if (largest) {
    insights.push({
      message: `Your largest expense this month was $${largest.amount.toFixed(2)} in ${largest.categoryName}.`,
      severity: "info",
    });
  }

  return insights;
}
