import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { monthRange, previousMonthKey, lastNMonthKeys } from "../lib/date";
import { computeInsights, InsightTransaction } from "../lib/insights";

const router = Router();

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchMonthTransactions(userId: string, month: string): Promise<InsightTransaction[]> {
  const { start, end } = monthRange(month);
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: { category: true },
  });
  return rows.map((t) => ({
    categoryId: t.categoryId,
    categoryName: t.category.name,
    amount: Number(t.amount),
    type: t.type,
  }));
}

router.get("/summary", async (req: AuthedRequest, res) => {
  const month = (req.query.month as string) || currentMonthKey();
  const userId = req.userId as string;

  const current = await fetchMonthTransactions(userId, month);
  const income = current.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = current.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expense;
  const savingsRate = income > 0 ? net / income : null;

  const categoryTotals = new Map<string, { categoryName: string; amount: number }>();
  for (const t of current.filter((t) => t.type === "expense")) {
    const entry = categoryTotals.get(t.categoryId) ?? { categoryName: t.categoryName, amount: 0 };
    entry.amount += t.amount;
    categoryTotals.set(t.categoryId, entry);
  }
  const byCategory = [...categoryTotals.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.categoryName,
      amount: v.amount,
      percent: expense > 0 ? (v.amount / expense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const trendMonths = lastNMonthKeys(month, 6);
  const trend = await Promise.all(
    trendMonths.map(async (m) => {
      const txns = await fetchMonthTransactions(userId, m);
      return {
        month: m,
        income: txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    })
  );

  res.json({
    month,
    totals: { income, expense, net, savingsRate },
    byCategory,
    trend,
  });
});

router.get("/insights", async (req: AuthedRequest, res) => {
  const month = (req.query.month as string) || currentMonthKey();
  const userId = req.userId as string;

  const [current, previous, budgetRows] = await Promise.all([
    fetchMonthTransactions(userId, month),
    fetchMonthTransactions(userId, previousMonthKey(month)),
    prisma.budget.findMany({ where: { userId }, include: { category: true } }),
  ]);

  const budgets = budgetRows.map((b) => ({
    categoryId: b.categoryId,
    categoryName: b.category.name,
    monthlyLimit: Number(b.monthlyLimit),
  }));

  const insights = computeInsights(current, previous, budgets);
  res.json({ month, insights });
});

export default router;
